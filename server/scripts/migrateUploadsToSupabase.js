const fs = require('fs/promises');
const path = require('path');
const { pool, query } = require('../config/db');
const { uploadImage } = require('../services/storageService');

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');
const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');
const MIME_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

function printUsage() {
  console.log('Usage:');
  console.log('  node server/scripts/migrateUploadsToSupabase.js --dry-run');
  console.log('  node server/scripts/migrateUploadsToSupabase.js --apply');
}

function resolveLegacyUpload(imageUrl) {
  const value = String(imageUrl || '').trim();
  if (!value.startsWith('/uploads/')) return null;

  let relativePath;
  try {
    relativePath = decodeURIComponent(value.slice('/uploads/'.length)).replace(/\\/g, '/');
  } catch {
    return null;
  }

  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length < 2 || parts.some((part) => part === '.' || part === '..')) return null;

  const absolutePath = path.resolve(UPLOADS_ROOT, ...parts);
  const uploadsPrefix = `${UPLOADS_ROOT}${path.sep}`;
  if (!absolutePath.startsWith(uploadsPrefix)) return null;

  const extension = path.extname(parts.at(-1)).toLowerCase();
  const contentType = MIME_TYPES.get(extension);
  if (!contentType) return null;

  return {
    legacyUrl: value,
    absolutePath,
    folder: parts.slice(0, -1).join('/'),
    fileName: parts.at(-1),
    extension: extension.slice(1),
    contentType,
  };
}

function findHtmlUploadUrls(html) {
  const matches = String(html || '').match(/\/uploads\/[^"'<>\s]+/g) || [];
  return [...new Set(matches)];
}

function sanitizeBaseName(fileName = 'image') {
  return path.parse(fileName).name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
}

function getGeneratedSuffix(fileName) {
  return fileName.replace(/^\d+-\d+-/, '').toLowerCase();
}

async function findOriginalSourceFile(file) {
  const directory = path.dirname(file.absolutePath);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }

  const expectedSuffix = getGeneratedSuffix(path.basename(file.absolutePath));
  const candidates = entries.filter((entry) => {
    if (!entry.isFile()) return false;
    const extension = path.extname(entry.name).toLowerCase();
    if (!MIME_TYPES.has(extension)) return false;
    return `${sanitizeBaseName(entry.name)}${extension}` === expectedSuffix;
  });

  return candidates.length === 1 ? path.join(directory, candidates[0].name) : null;
}

async function collectMigrationPlan() {
  const [products, news, paymentSettings, payments, siteContent] = await Promise.all([
    query('SELECT product_id, image_url FROM products WHERE image_url IS NOT NULL'),
    query('SELECT news_id, image_url FROM news WHERE image_url IS NOT NULL'),
    query('SELECT payment_setting_id, qr_image_url FROM payment_settings WHERE qr_image_url IS NOT NULL'),
    query('SELECT payment_id, slip_image FROM payments WHERE slip_image IS NOT NULL'),
    query('SELECT content_key, content_html FROM site_content'),
  ]);

  const updates = [];
  for (const row of products) {
    if (resolveLegacyUpload(row.image_url)) {
      updates.push({ table: 'products', idField: 'product_id', id: row.product_id, field: 'image_url', value: row.image_url });
    }
  }
  for (const row of news) {
    if (resolveLegacyUpload(row.image_url)) {
      updates.push({ table: 'news', idField: 'news_id', id: row.news_id, field: 'image_url', value: row.image_url });
    }
  }
  for (const row of paymentSettings) {
    if (resolveLegacyUpload(row.qr_image_url)) {
      updates.push({ table: 'payment_settings', idField: 'payment_setting_id', id: row.payment_setting_id, field: 'qr_image_url', value: row.qr_image_url });
    }
  }
  for (const row of payments) {
    if (resolveLegacyUpload(row.slip_image)) {
      updates.push({ table: 'payments', idField: 'payment_id', id: row.payment_id, field: 'slip_image', value: row.slip_image });
    }
  }

  const htmlUpdates = siteContent
    .map((row) => ({ ...row, legacyUrls: findHtmlUploadUrls(row.content_html) }))
    .filter((row) => row.legacyUrls.some((url) => resolveLegacyUpload(url)));

  const files = new Map();
  for (const update of updates) files.set(update.value, resolveLegacyUpload(update.value));
  for (const update of htmlUpdates) {
    for (const legacyUrl of update.legacyUrls) {
      const file = resolveLegacyUpload(legacyUrl);
      if (file) files.set(legacyUrl, file);
    }
  }

  return { updates, htmlUpdates, files };
}

async function inspectFiles(files) {
  const missing = [];
  for (const file of files.values()) {
    try {
      const stats = await fs.stat(file.absolutePath);
      if (!stats.isFile()) missing.push(file);
    } catch {
      const originalSource = await findOriginalSourceFile(file);
      if (originalSource) {
        file.absolutePath = originalSource;
        file.matchedOriginalName = path.basename(originalSource);
      } else {
        missing.push(file);
      }
    }
  }
  return missing;
}

function printPlan(plan, missing) {
  console.log(`${APPLY ? 'Apply' : 'Dry run'}: ${plan.files.size} file(s), ${plan.updates.length} field update(s), ${plan.htmlUpdates.length} HTML record(s).`);
  for (const file of plan.files.values()) {
    const marker = missing.includes(file) ? 'MISSING' : 'READY';
    const source = file.matchedOriginalName ? ` (matched local file: ${file.matchedOriginalName})` : '';
    console.log(`[${marker}] ${file.legacyUrl} -> ${file.folder}/${source}`);
  }
}

async function uploadFiles(files) {
  const migratedUrls = new Map();
  let completed = 0;

  for (const file of files.values()) {
    const buffer = await fs.readFile(file.absolutePath);
    const publicUrl = await uploadImage({
      buffer,
      contentType: file.contentType,
      fileName: file.fileName,
      folder: file.folder,
      extension: file.extension,
    });
    migratedUrls.set(file.legacyUrl, publicUrl);
    completed += 1;
    console.log(`Uploaded ${completed}/${files.size}: ${file.legacyUrl}`);
  }

  return migratedUrls;
}

async function updateDatabase(plan, migratedUrls) {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();

    for (const update of plan.updates) {
      await client.query(
        `UPDATE ${update.table} SET ${update.field} = ? WHERE ${update.idField} = ? AND ${update.field} = ?`,
        [migratedUrls.get(update.value), update.id, update.value],
      );
    }

    for (const update of plan.htmlUpdates) {
      let nextHtml = update.content_html;
      for (const legacyUrl of update.legacyUrls) {
        const publicUrl = migratedUrls.get(legacyUrl);
        if (publicUrl) nextHtml = nextHtml.split(legacyUrl).join(publicUrl);
      }
      await client.query(
        'UPDATE site_content SET content_html = ?, updated_at = NOW() WHERE content_key = ? AND content_html = ?',
        [nextHtml, update.content_key, update.content_html],
      );
    }

    await client.commit();
  } catch (error) {
    await client.rollback().catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  if (APPLY === DRY_RUN) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!pool) throw new Error('SUPABASE_DB_URL is not configured');

  const plan = await collectMigrationPlan();
  const missing = await inspectFiles(plan.files);
  printPlan(plan, missing);

  if (missing.length > 0) {
    throw new Error(`${missing.length} referenced file(s) are missing. Restore them before running --apply.`);
  }
  if (!APPLY || plan.files.size === 0) return;

  const migratedUrls = await uploadFiles(plan.files);
  await updateDatabase(plan, migratedUrls);
  console.log(`Migration complete. Uploaded ${migratedUrls.size} file(s). Local files were not deleted.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) await pool.end().catch(() => {});
    });
}

module.exports = { findHtmlUploadUrls, resolveLegacyUpload };
