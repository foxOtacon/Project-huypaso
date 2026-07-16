const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

const NEWS_FIELDS = [
  "title",
  "summary",
  "content",
  "image_url",
  "category",
  "status",
  "created_by",
];

function buildPayload(body) {
  const payload = {};

  for (const field of NEWS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  return payload;
}

async function getNewsById(newsId, { publicOnly = false } = {}) {
  const rows = await query(
    `SELECT n.*, u.full_name AS author_name
     FROM news n
     LEFT JOIN users u ON n.created_by = u.user_id
     WHERE n.news_id = ?${publicOnly ? " AND n.status = 'published'" : ""}
     LIMIT 1`,
    [newsId],
  );

  return rows[0] || null;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT n.*, u.full_name AS author_name
       FROM news n
       LEFT JOIN users u ON n.created_by = u.user_id
       WHERE n.status = 'published'
       ORDER BY n.created_at DESC, n.news_id DESC`,
    );

    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT n.*, u.full_name AS author_name
       FROM news n
       LEFT JOIN users u ON n.created_by = u.user_id
       ORDER BY n.created_at DESC, n.news_id DESC`,
    );

    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await getNewsById(req.params.id, { publicOnly: true });

    if (!item) {
      res.status(404).json({ success: false, message: "News not found" });
      return;
    }

    res.json({ success: true, data: item });
  }),
);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const payload = buildPayload({
      ...req.body,
      created_by: req.body.created_by || req.user.user_id,
    });

    if (!payload.title || !payload.content) {
      res.status(400).json({ success: false, message: "title and content are required" });
      return;
    }

    const columns = Object.keys(payload);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((column) => payload[column]);
    const result = await query(
      `INSERT INTO news (${columns.join(", ")}) VALUES (${placeholders})`,
      values,
    );
    const saved = await getNewsById(result.insertId);

    res.status(201).json({ success: true, data: saved });
  }),
);

router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const payload = buildPayload(req.body);

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }

    const columns = Object.keys(payload);
    const assignments = columns.map((column) => `${column} = ?`).join(", ");
    const values = [...columns.map((column) => payload[column]), req.params.id];
    const result = await query(`UPDATE news SET ${assignments} WHERE news_id = ?`, values);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "News not found" });
      return;
    }

    const saved = await getNewsById(req.params.id);
    res.json({ success: true, data: saved });
  }),
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM news WHERE news_id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "News not found" });
      return;
    }

    res.json({ success: true, message: "News deleted successfully" });
  }),
);

module.exports = router;
