const express = require('express');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function validateAddressPayload(body = {}) {
  const label = String(body.label || '').trim();
  const recipientName = String(body.recipient_name || '').trim();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();

  if (!label || !recipientName || !phone || !address) {
    return { error: 'กรุณากรอกชื่อที่อยู่ ผู้รับ เบอร์โทร และที่อยู่ให้ครบถ้วน' };
  }

  return { value: { label, recipientName, phone, address } };
}

async function setDefaultAddress(userId, addressId) {
  await query('UPDATE user_addresses SET is_default = FALSE, updated_at = NOW() WHERE user_id = ?', [userId]);
  await query('UPDATE user_addresses SET is_default = TRUE, updated_at = NOW() WHERE address_id = ? AND user_id = ?', [addressId, userId]);
}

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT address_id, label, recipient_name, phone, address, is_default, created_at, updated_at
     FROM user_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, updated_at DESC, address_id DESC`,
    [req.user.user_id],
  );
  res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const parsed = validateAddressPayload(req.body);
  if (parsed.error) {
    res.status(400).json({ success: false, message: parsed.error });
    return;
  }

  const existing = await query('SELECT address_id FROM user_addresses WHERE user_id = ? LIMIT 1', [req.user.user_id]);
  const isDefault = req.body.is_default === true || existing.length === 0;
  const result = await query(
    `INSERT INTO user_addresses (user_id, label, recipient_name, phone, address, is_default, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [req.user.user_id, parsed.value.label, parsed.value.recipientName, parsed.value.phone, parsed.value.address, isDefault],
  );

  if (isDefault) await setDefaultAddress(req.user.user_id, result.insertId);
  const rows = await query('SELECT * FROM user_addresses WHERE address_id = ? AND user_id = ?', [result.insertId, req.user.user_id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = validateAddressPayload(req.body);
  if (parsed.error) {
    res.status(400).json({ success: false, message: parsed.error });
    return;
  }

  const addressId = req.params.id;
  const existing = await query('SELECT address_id FROM user_addresses WHERE address_id = ? AND user_id = ?', [addressId, req.user.user_id]);
  if (!existing.length) {
    res.status(404).json({ success: false, message: 'ไม่พบที่อยู่นี้' });
    return;
  }

  await query(
    `UPDATE user_addresses
     SET label = ?, recipient_name = ?, phone = ?, address = ?, updated_at = NOW()
     WHERE address_id = ? AND user_id = ?`,
    [parsed.value.label, parsed.value.recipientName, parsed.value.phone, parsed.value.address, addressId, req.user.user_id],
  );
  if (req.body.is_default === true) await setDefaultAddress(req.user.user_id, addressId);
  const rows = await query('SELECT * FROM user_addresses WHERE address_id = ? AND user_id = ?', [addressId, req.user.user_id]);
  res.json({ success: true, data: rows[0] });
}));

router.put('/:id/default', asyncHandler(async (req, res) => {
  const existing = await query('SELECT address_id FROM user_addresses WHERE address_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);
  if (!existing.length) {
    res.status(404).json({ success: false, message: 'ไม่พบที่อยู่นี้' });
    return;
  }
  await setDefaultAddress(req.user.user_id, req.params.id);
  res.json({ success: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await query('SELECT is_default FROM user_addresses WHERE address_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);
  if (!existing.length) {
    res.status(404).json({ success: false, message: 'ไม่พบที่อยู่นี้' });
    return;
  }
  await query('DELETE FROM user_addresses WHERE address_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);
  if (existing[0].is_default) {
    const replacement = await query('SELECT address_id FROM user_addresses WHERE user_id = ? ORDER BY updated_at DESC, address_id DESC LIMIT 1', [req.user.user_id]);
    if (replacement.length) await setDefaultAddress(req.user.user_id, replacement[0].address_id);
  }
  res.json({ success: true });
}));

module.exports = router;