const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
).replace(/\/$/, '');

const PASSTHROUGH_URL_PATTERN = /^(?:https?:|data:|blob:)/i;

export function getImageUrl(imageUrl, fallback = '') {
  const normalizedUrl = String(imageUrl || '').trim();

  if (!normalizedUrl) return fallback;
  if (PASSTHROUGH_URL_PATTERN.test(normalizedUrl)) return normalizedUrl;

  return `${BACKEND_URL}${normalizedUrl.startsWith('/') ? '' : '/'}${normalizedUrl}`;
}

export function resolveImageUrlsInHtml(html) {
  return String(html || '').replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])(.*?)\2/gi,
    (_match, prefix, quote, src) => `${prefix}${quote}${getImageUrl(src)}${quote}`,
  );
}
