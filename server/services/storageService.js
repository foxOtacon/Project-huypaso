const path = require('path');

function getStorageConfig() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const secretKey = String(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  const publicBucket = String(process.env.SUPABASE_PUBLIC_BUCKET || 'huypaso-public').trim();
  const privateBucket = String(
    process.env.SUPABASE_PRIVATE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'huypaso-images',
  ).trim();
  if (!supabaseUrl || !secretKey) {
    const error = new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
    error.status = 503;
    throw error;
  }
  return { supabaseUrl, secretKey, publicBucket, privateBucket };
}

function requestHeaders(secretKey, extra = {}) {
  const headers = { apikey: secretKey, ...extra };
  if (secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${secretKey}`;
  return headers;
}

function sanitizeBaseName(fileName = 'image') {
  return path.parse(fileName).name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
}

function encodeObjectPath(objectPath) {
  return objectPath.split('/').map(encodeURIComponent).join('/');
}

function createObjectPath(folder, fileName, extension) {
  const safeFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  if (!safeFolder || safeFolder.split('/').some((part) => !/^[a-z0-9_-]+$/i.test(part))) {
    const error = new Error('Invalid storage folder'); error.status = 500; throw error;
  }
  const safeExtension = String(extension || '').replace(/^\./, '').toLowerCase();
  return `${safeFolder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizeBaseName(fileName)}.${safeExtension}`;
}

async function storageError(response) {
  const payload = await response.json().catch(() => ({}));
  return payload.message || payload.error || `Supabase Storage request failed (${response.status})`;
}

async function uploadImage({ buffer, contentType, fileName, folder, extension }) {
  const { supabaseUrl, secretKey, publicBucket, privateBucket } = getStorageConfig();
  const isPrivate = ['slips', 'payments'].includes(String(folder).split('/')[0]);
  const bucket = isPrivate ? privateBucket : publicBucket;
  const objectPath = createObjectPath(folder, fileName, extension);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`, {
    method: 'POST',
    headers: requestHeaders(secretKey, { 'Content-Type': contentType, 'x-upsert': 'false' }),
    body: buffer,
  });
  if (!response.ok) {
    const error = new Error(await storageError(response));
    error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return isPrivate
    ? `supabase-storage://${bucket}/${objectPath}`
    : `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
}

function parseStorageObject(imageUrl) {
  const { supabaseUrl, publicBucket, privateBucket } = getStorageConfig();
  const value = String(imageUrl || '');
  if (value.startsWith('supabase-storage://')) {
    const rest = value.slice('supabase-storage://'.length);
    const separator = rest.indexOf('/');
    if (separator <= 0) return null;
    const bucket = rest.slice(0, separator);
    return [publicBucket, privateBucket].includes(bucket)
      ? { bucket, objectPath: rest.slice(separator + 1) }
      : null;
  }
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.origin !== new URL(supabaseUrl).origin) return null;
  for (const bucket of [publicBucket, privateBucket]) {
    const prefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    if (url.pathname.startsWith(prefix)) {
      return { bucket, objectPath: decodeURIComponent(url.pathname.slice(prefix.length)) };
    }
  }
  return null;
}

async function deleteStoredImage(imageUrl) {
  const object = parseStorageObject(imageUrl);
  if (!object) return false;
  const { supabaseUrl, secretKey } = getStorageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(object.bucket)}`, {
    method: 'DELETE',
    headers: requestHeaders(secretKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [object.objectPath] }),
  });
  if (!response.ok) { const error = new Error(await storageError(response)); error.status = 502; throw error; }
  return true;
}

async function createSignedImageUrl(imageUrl, expiresIn = 300) {
  const object = parseStorageObject(imageUrl);
  if (!object) return imageUrl;
  const { supabaseUrl, secretKey, privateBucket } = getStorageConfig();
  if (object.bucket !== privateBucket) return imageUrl;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(object.bucket)}/${encodeObjectPath(object.objectPath)}`, {
    method: 'POST',
    headers: requestHeaders(secretKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) { const error = new Error(await storageError(response)); error.status = 502; throw error; }
  const payload = await response.json();
  const signedUrl = payload.signedURL || payload.signedUrl;
  if (!signedUrl) throw new Error('Supabase Storage did not return a signed URL');
  if (signedUrl.startsWith('http')) return signedUrl;
  const normalizedPath = signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`;
  return normalizedPath.startsWith('/storage/v1/')
    ? `${supabaseUrl}${normalizedPath}`
    : `${supabaseUrl}/storage/v1${normalizedPath}`;
}

module.exports = { createSignedImageUrl, deleteStoredImage, uploadImage };
