const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { ensureContactTicketSchema, getTicket, getReplies, canAccessTicket } = require("../services/contactTicketService");

const router = express.Router();
const optionalAuthenticate = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
const clean = (value, max = 5000) => String(value || '').trim().slice(0, max);

router.post("/", optionalAuthenticate, asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const name = clean(req.body?.name, 200);
  const email = clean(req.body?.email, 200);
  const category = clean(req.body?.category || 'general', 40);
  const subject = clean(req.body?.subject, 255);
  const message = clean(req.body?.message);
  const orderId = req.body?.order_id ? Number(req.body.order_id) : null;
  if (!name || !email || !message) return res.status(400).json({ success: false, message: "กรุณากรอกชื่อ อีเมล และรายละเอียดปัญหา" });
  if (orderId && (!Number.isInteger(orderId) || orderId <= 0)) return res.status(400).json({ success: false, message: "เลขคำสั่งซื้อไม่ถูกต้อง" });
  if (orderId && req.user?.role !== 'admin') {
    const orders = await query(`SELECT order_id FROM orders WHERE order_id = ? AND user_id = ? LIMIT 1`, [orderId, req.user?.user_id || -1]);
    if (!orders.length) return res.status(400).json({ success: false, message: "ไม่พบคำสั่งซื้อในบัญชีของคุณ" });
  }
  const result = await query(`INSERT INTO contacts (user_id, name, email, category, order_id, subject, message, status, ticket_status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'new', NOW())`, [req.user?.user_id || null, name, email, category, orderId, subject || null, message]);
  const ticket = await getTicket(result.insertId);
  res.status(201).json({ success: true, data: ticket });
}));

router.get("/mine", authenticate, asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const rows = await query(`SELECT c.*, COALESCE(c.ticket_status, c.status) AS ticket_state,
    (SELECT COUNT(*)::int FROM contact_replies r WHERE r.contact_id = c.contact_id) AS reply_count,
    (SELECT COUNT(*)::int FROM contact_replies r WHERE r.contact_id = c.contact_id AND r.sender_role = 'admin') AS admin_reply_count
    FROM contacts c WHERE c.user_id = ? ORDER BY COALESCE(c.last_reply_at, c.created_at) DESC`, [req.user.user_id]);
  res.json({ success: true, data: rows.map((item) => ({ ...item, status: item.ticket_state || item.status })) });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const ticket = await getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "ไม่พบรายการติดต่อ" });
  if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ success: false, message: "Forbidden" });
  const replies = await getReplies(req.params.id);
  res.json({ success: true, data: { ...ticket, replies } });
}));

router.post("/:id/replies", authenticate, asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const ticket = await getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "ไม่พบรายการติดต่อ" });
  if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ success: false, message: "Forbidden" });
  const message = clean(req.body?.message);
  if (!message) return res.status(400).json({ success: false, message: "กรุณากรอกข้อความ" });
  await query(`INSERT INTO contact_replies (contact_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)`, [ticket.contact_id, req.user.user_id, req.user.role, message]);
  await query(`UPDATE contacts SET ticket_status = ?, updated_at = NOW(), last_reply_at = NOW() WHERE contact_id = ?`, [req.user.role === 'admin' ? 'in_progress' : 'new', ticket.contact_id]);
  const updated = await getTicket(ticket.contact_id);
  res.status(201).json({ success: true, data: { ...updated, replies: await getReplies(ticket.contact_id) } });
}));

module.exports = router;
