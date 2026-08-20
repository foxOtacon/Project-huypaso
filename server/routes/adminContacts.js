const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const { ensureContactTicketSchema, getTicket, getReplies } = require("../services/contactTicketService");

const router = express.Router();
router.use(authenticate, authorize("admin"));

router.get("/", asyncHandler(async (_req, res) => {
  await ensureContactTicketSchema();
  const rows = await query(`SELECT c.*, COALESCE(c.ticket_status, c.status) AS ticket_state,
    (SELECT COUNT(*)::int FROM contact_replies r WHERE r.contact_id = c.contact_id) AS reply_count
    FROM contacts c ORDER BY CASE COALESCE(c.ticket_status, c.status) WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, COALESCE(c.last_reply_at, c.created_at) DESC`);
  res.json({ success: true, data: rows.map((item) => ({ ...item, status: item.ticket_state || item.status })) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const ticket = await getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "ไม่พบรายการติดต่อ" });
  res.json({ success: true, data: { ...ticket, replies: await getReplies(req.params.id) } });
}));

router.put("/:id/status", asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const status = String(req.body?.status || '');
  if (!['new', 'in_progress', 'resolved'].includes(status)) return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
  const result = await query(`UPDATE contacts SET ticket_status = ?, updated_at = NOW() WHERE contact_id = ?`, [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "ไม่พบรายการติดต่อ" });
  res.json({ success: true, data: await getTicket(req.params.id) });
}));

router.post("/:id/replies", asyncHandler(async (req, res) => {
  await ensureContactTicketSchema();
  const ticket = await getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "ไม่พบรายการติดต่อ" });
  const message = String(req.body?.message || '').trim().slice(0, 5000);
  if (!message) return res.status(400).json({ success: false, message: "กรุณากรอกข้อความตอบกลับ" });
  await query(`INSERT INTO contact_replies (contact_id, sender_id, sender_role, message) VALUES (?, ?, 'admin', ?)`, [ticket.contact_id, req.user.user_id, message]);
  await query(`UPDATE contacts SET ticket_status = 'in_progress', updated_at = NOW(), last_reply_at = NOW() WHERE contact_id = ?`, [ticket.contact_id]);
  res.status(201).json({ success: true, data: { ...(await getTicket(ticket.contact_id)), replies: await getReplies(ticket.contact_id) } });
}));

module.exports = router;
