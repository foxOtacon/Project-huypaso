const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findHtmlUploadUrls,
  resolveLegacyUpload,
} = require('../scripts/migrateUploadsToSupabase');

test('resolveLegacyUpload accepts safe supported upload paths', () => {
  const file = resolveLegacyUpload('/uploads/products/example image.png');
  assert.equal(file.folder, 'products');
  assert.equal(file.fileName, 'example image.png');
  assert.equal(file.contentType, 'image/png');
});

test('resolveLegacyUpload rejects traversal and non-image paths', () => {
  assert.equal(resolveLegacyUpload('/uploads/products/../secret.png'), null);
  assert.equal(resolveLegacyUpload('/uploads/products/file.txt'), null);
  assert.equal(resolveLegacyUpload('https://example.com/image.png'), null);
});

test('findHtmlUploadUrls returns unique legacy image paths', () => {
  const html = '<img src="/uploads/history/one.png"><img src="/uploads/history/one.png"><img src="https://example.com/two.png">';
  assert.deepEqual(findHtmlUploadUrls(html), ['/uploads/history/one.png']);
});
