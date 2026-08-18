const test = require('node:test');
const assert = require('node:assert/strict');

const { deleteStoredImage, uploadImage } = require('../services/storageService');

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
];

function configureStorage() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice-role-key';
  process.env.SUPABASE_STORAGE_BUCKET = 'huypaso-images';
}

test.afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

test('uploadImage uploads bytes and returns a public URL', async (t) => {
  configureStorage();
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });

  global.fetch = async (url, options) => {
    assert.match(url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/huypaso-public\/products\//);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer eyJservice-role-key');
    assert.equal(options.headers['Content-Type'], 'image/png');
    assert.deepEqual(options.body, Buffer.from('image'));
    return { ok: true };
  };

  const url = await uploadImage({
    buffer: Buffer.from('image'),
    contentType: 'image/png',
    fileName: 'My Product.png',
    folder: 'products',
    extension: 'png',
  });

  assert.match(url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/huypaso-public\/products\//);
  assert.match(url, /-my-product\.png$/);
});

test('deleteStoredImage only deletes URLs from the configured public bucket', async (t) => {
  configureStorage();
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let requestBody;

  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true };
  };

  assert.equal(await deleteStoredImage('https://cdn.example.com/image.png'), false);
  assert.equal(
    await deleteStoredImage('https://example.supabase.co/storage/v1/object/public/huypaso-images/products/example.png'),
    true,
  );
  assert.deepEqual(requestBody, { prefixes: ['products/example.png'] });
});
