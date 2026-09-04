const express = require('express');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const MAX_GALLERY_IMAGES = 4;

router.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(
    'SELECT gallery_id, image_url, alt_text, sort_order, created_at, updated_at FROM site_gallery ORDER BY sort_order, gallery_id',
  );
  res.json({ success: true, data: rows });
}));

router.use(authenticate, authorize('admin'));

router.post('/', asyncHandler(async (req, res) => {
  const imageUrl = String(req.body?.image_url || '').trim();
  const altText = String(req.body?.alt_text || '').trim();
  if (!imageUrl) {
    res.status(400).json({ success: false, message: 'กรุณาระบุรูปภาพ' });
    return;
  }
  const countRows = await query('SELECT COUNT(*) AS total FROM site_gallery');
  if (Number(countRows[0]?.total || 0) >= MAX_GALLERY_IMAGES) {
    res.status(400).json({ success: false, message: `แกลเลอรี่มีได้สูงสุด ${MAX_GALLERY_IMAGES} รูป` });
    return;
  }
  const result = await query(
    'INSERT INTO site_gallery (image_url, alt_text, sort_order, updated_at) VALUES (?, ?, ?, NOW())',
    [imageUrl, altText, Number(req.body?.sort_order || 0)],
  );
  const rows = await query('SELECT * FROM site_gallery WHERE gallery_id = ?', [result.insertId]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const imageUrl = String(req.body?.image_url || '').trim();
  const altText = String(req.body?.alt_text || '').trim();
  if (!imageUrl) {
    res.status(400).json({ success: false, message: 'กรุณาระบุรูปภาพ' });
    return;
  }
  const result = await query(
    'UPDATE site_gallery SET image_url = ?, alt_text = ?, sort_order = ?, updated_at = NOW() WHERE gallery_id = ?',
    [imageUrl, altText, Number(req.body?.sort_order || 0), req.params.id],
  );
  if (!result.affectedRows) {
    res.status(404).json({ success: false, message: 'ไม่พบรูป Gallery' });
    return;
  }
  const rows = await query('SELECT * FROM site_gallery WHERE gallery_id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM site_gallery WHERE gallery_id = ?', [req.params.id]);
  res.json({ success: true });
}));

module.exports = router;