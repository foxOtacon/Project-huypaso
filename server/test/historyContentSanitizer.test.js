const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeHistoryHtml } = require('../utils/historyContentSanitizer');

test('keeps CKEditor history images, captions, alignment and tables', () => {
  const input = `<p style=text-align:center;color:#336699>heading</p>
    <figure class=image style=width:50%>
      <img src=/uploads/history/photo.webp alt=community><figcaption>caption</figcaption>
    </figure>
    <figure class=table><table><tbody><tr><td rowspan=2 style=background-color:hsl(120,50%,90%);vertical-align:middle>a</td><td>b</td></tr></tbody></table></figure>`;
  const output = sanitizeHistoryHtml(input);
  assert.match(output, /class=.image/);
  assert.match(output, /\/uploads\/history\/photo.webp/);
  assert.match(output, /<figcaption>caption<\/figcaption>/);
  assert.match(output, /<table>/);
  assert.match(output, /rowspan=.2/);
  assert.match(output, /text-align:center/);
  assert.match(output, /background-color:hsl\(120,50%,90%\)/);
  assert.match(output, /vertical-align:middle/);
});

test('removes executable HTML, event attributes and unsafe URL schemes', () => {
  const output = sanitizeHistoryHtml(
    `<script>alert(1)</script><iframe src=https://example.com></iframe>
      <img src=javascript:alert(1) onerror=alert(2)>
      <a href=data:text/html,bad onclick=alert(3)>link</a>`,
  );
  assert.doesNotMatch(output, /script|iframe|onerror|onclick|javascript:|data:/i);
  assert.match(output, /<img\s*\/>\s*<a>link<\/a>/);
});
