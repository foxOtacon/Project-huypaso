const sanitizeHtml = require('sanitize-html');

const SAFE_COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*[\d.%]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+(?:\s*,\s*[\d.]+)?\s*\)$/i,
  /^hsla?\(\s*[\d.]+(?:deg)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)$/i,
];
const SAFE_LENGTH = [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/];

const HISTORY_SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 's', 'a',
    'ul', 'ol', 'li', 'blockquote', 'hr', 'figure', 'figcaption', 'img',
    'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    figure: ['class', 'style'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    table: ['style'],
    th: ['colspan', 'rowspan', 'scope', 'style'],
    td: ['colspan', 'rowspan', 'style'],
    p: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    li: ['style'],
    blockquote: ['style'],
    span: ['style'],
  },
  allowedClasses: {
    figure: [
      'image', 'image-inline', 'table', 'image-style-block-align-left',
      'image-style-block-align-right', 'image-style-align-left',
      'image-style-align-center', 'image-style-align-right', 'image-style-side',
    ],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|center|right|justify)$/],
      color: SAFE_COLOR,
      'background-color': SAFE_COLOR,
      'margin-left': SAFE_LENGTH,
    },
    figure: { width: [/^\d+(?:\.\d+)?%$/] },
    img: {
      width: [/^\d+(?:\.\d+)?(?:px|%)$/],
      height: [/^(?:auto|\d+(?:\.\d+)?px)$/],
    },
    table: {
      width: SAFE_LENGTH,
      'background-color': SAFE_COLOR,
      'border-color': SAFE_COLOR,
      'border-style': [/^(?:none|solid|dashed|dotted|double)$/],
      'border-width': SAFE_LENGTH,
    },
    th: {
      width: SAFE_LENGTH,
      height: SAFE_LENGTH,
      'background-color': SAFE_COLOR,
      'border-color': SAFE_COLOR,
      'border-style': [/^(?:none|solid|dashed|dotted|double)$/],
      'border-width': SAFE_LENGTH,
      'vertical-align': [/^(?:top|middle|bottom)$/],
    },
    td: {
      width: SAFE_LENGTH,
      height: SAFE_LENGTH,
      'background-color': SAFE_COLOR,
      'border-color': SAFE_COLOR,
      'border-style': [/^(?:none|solid|dashed|dotted|double)$/],
      'border-width': SAFE_LENGTH,
      'vertical-align': [/^(?:top|middle|bottom)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
};

function sanitizeHistoryHtml(html) {
  return sanitizeHtml(html, HISTORY_SANITIZE_OPTIONS).trim();
}

function hasMeaningfulHistoryContent(html) {
  if (/<(?:img|table|hr)\b/i.test(html)) return true;
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length > 0;
}

module.exports = { HISTORY_SANITIZE_OPTIONS, sanitizeHistoryHtml, hasMeaningfulHistoryContent };
