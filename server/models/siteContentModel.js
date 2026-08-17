const { query } = require("../config/db");

async function getSiteContent(contentKey) {
  const rows = await query(
    `SELECT sc.content_key,
            sc.content_html,
            sc.updated_at,
            sc.updated_by,
            u.full_name AS updated_by_name
     FROM site_content sc
     LEFT JOIN users u ON u.user_id = sc.updated_by
     WHERE sc.content_key = ?
     LIMIT 1`,
    [contentKey],
  );

  return rows[0] || null;
}

async function upsertSiteContent({ contentKey, contentHtml, updatedBy }) {
  await query(
    `INSERT INTO site_content (content_key, content_html, updated_at, updated_by)
     VALUES (?, ?, NOW(), ?)
     ON CONFLICT (content_key) DO UPDATE SET
       content_html = EXCLUDED.content_html,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [contentKey, contentHtml, updatedBy],
  );

  return getSiteContent(contentKey);
}

module.exports = { getSiteContent, upsertSiteContent };
