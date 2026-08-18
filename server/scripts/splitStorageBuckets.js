const { pool, query } = require('../config/db');

const APPLY = process.argv.includes('--apply');
const SOURCE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'huypaso-images';
const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || 'huypaso-public';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra = {}) {
  const result = { apikey: SECRET_KEY, ...extra };
  if (String(SECRET_KEY || '').startsWith('eyJ')) result.Authorization = `Bearer ${SECRET_KEY}`;
  return result;
}

function encodePath(value) { return value.split('/').map(encodeURIComponent).join('/'); }

function parseSourceUrl(value) {
  try {
    const url = new URL(value);
    const prefix = `/storage/v1/object/public/${encodeURIComponent(SOURCE_BUCKET)}/`;
    if (url.origin !== new URL(SUPABASE_URL).origin || !url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch { return null; }
}

function publicUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(PUBLIC_BUCKET)}/${encodePath(objectPath)}`;
}

async function ensurePublicBucket() {
  let response = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${encodeURIComponent(PUBLIC_BUCKET)}`, { headers: headers() });
  const lookupPayload = response.ok ? await response.json() : await response.json().catch(() => ({}));
  if (!response.ok && (response.status === 404 || lookupPayload.code === 'NoSuchBucket')) {
    response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: PUBLIC_BUCKET, name: PUBLIC_BUCKET, public: true }),
    });
  } else if (response.ok) {
    if (!lookupPayload.public) {
      response = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${encodeURIComponent(PUBLIC_BUCKET)}`, {
        method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ public: true }),
      });
    }
  }
  if (!response.ok) throw new Error(`Cannot create/update public bucket: ${await response.text()}`);
}

async function collectPlan() {
  const [products, news, settings, payments, content] = await Promise.all([
    query('SELECT product_id AS id, image_url AS url FROM products WHERE image_url IS NOT NULL'),
    query('SELECT news_id AS id, image_url AS url FROM news WHERE image_url IS NOT NULL'),
    query('SELECT payment_setting_id AS id, qr_image_url AS url FROM payment_settings WHERE qr_image_url IS NOT NULL'),
    query('SELECT payment_id AS id, slip_image AS url FROM payments WHERE slip_image IS NOT NULL'),
    query('SELECT content_key, content_html FROM site_content'),
  ]);
  const updates = [];
  for (const row of products) { const objectPath = parseSourceUrl(row.url); if (objectPath) updates.push({ table: 'products', idField: 'product_id', field: 'image_url', ...row, objectPath }); }
  for (const row of news) { const objectPath = parseSourceUrl(row.url); if (objectPath) updates.push({ table: 'news', idField: 'news_id', field: 'image_url', ...row, objectPath }); }
  for (const row of settings) { const objectPath = parseSourceUrl(row.url); if (objectPath) updates.push({ table: 'payment_settings', idField: 'payment_setting_id', field: 'qr_image_url', ...row, objectPath }); }
  const privateUpdates = payments.map((row) => ({ ...row, objectPath: parseSourceUrl(row.url) })).filter((row) => row.objectPath);
  const htmlUpdates = content.map((row) => {
    const urls = String(row.content_html || '').match(/https:\/\/[^"'<>\s]+\/storage\/v1\/object\/public\/[^"'<>\s]+/g) || [];
    return { ...row, urls: [...new Set(urls)].filter(parseSourceUrl) };
  }).filter((row) => row.urls.length);
  const paths = new Set(updates.map((row) => row.objectPath));
  for (const row of htmlUpdates) for (const url of row.urls) paths.add(parseSourceUrl(url));
  return { updates, privateUpdates, htmlUpdates, paths };
}

async function copyObject(objectPath) {
  const source = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(SOURCE_BUCKET)}/${encodePath(objectPath)}`, { headers: headers() });
  if (!source.ok) throw new Error(`Download failed for ${objectPath}: ${await source.text()}`);
  const buffer = Buffer.from(await source.arrayBuffer());
  const target = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(PUBLIC_BUCKET)}/${encodePath(objectPath)}`, {
    method: 'POST', headers: headers({ 'Content-Type': source.headers.get('content-type') || 'application/octet-stream', 'x-upsert': 'true' }), body: buffer,
  });
  if (!target.ok) throw new Error(`Upload failed for ${objectPath}: ${await target.text()}`);
}

async function updateDatabase(plan) {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    for (const row of plan.updates) await client.query(`UPDATE ${row.table} SET ${row.field} = ? WHERE ${row.idField} = ? AND ${row.field} = ?`, [publicUrl(row.objectPath), row.id, row.url]);
    for (const row of plan.privateUpdates) await client.query('UPDATE payments SET slip_image = ? WHERE payment_id = ? AND slip_image = ?', [`supabase-storage://${SOURCE_BUCKET}/${row.objectPath}`, row.id, row.url]);
    for (const row of plan.htmlUpdates) {
      let html = row.content_html;
      for (const url of row.urls) html = html.split(url).join(publicUrl(parseSourceUrl(url)));
      await client.query('UPDATE site_content SET content_html = ?, updated_at = NOW() WHERE content_key = ? AND content_html = ?', [html, row.content_key, row.content_html]);
    }
    await client.commit();
  } catch (error) { await client.rollback().catch(() => {}); throw error; } finally { client.release(); }
}

async function main() {
  if (!SUPABASE_URL || !SECRET_KEY || !pool) throw new Error('Supabase environment is incomplete');
  const plan = await collectPlan();
  console.log(`${APPLY ? 'Apply' : 'Dry run'}: ${plan.paths.size} public object(s), ${plan.privateUpdates.length} private slip reference(s).`);
  if (!APPLY) return;
  await ensurePublicBucket();
  let count = 0;
  for (const objectPath of plan.paths) { await copyObject(objectPath); count += 1; console.log(`Copied ${count}/${plan.paths.size}: ${objectPath}`); }
  await updateDatabase(plan);
  console.log('Public/private bucket migration complete. Source objects were not deleted.');
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (pool) await pool.end().catch(() => {}); });
