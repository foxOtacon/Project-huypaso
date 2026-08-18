const express = require("express");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT contact_id, name, email, subject, message, status, created_at
       FROM contacts
       ORDER BY created_at DESC`,
    );

    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT contact_id, name, email, subject, message, status, created_at
       FROM contacts WHERE contact_id = ? LIMIT 1`,
      [req.params.id],
    );

    if (!rows[0]) {
      res.status(404).json({ success: false, message: 'Contact not found' });
      return;
    }

    res.json({ success: true, data: rows[0] });
  }),
);

router.put(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const result = await query(`UPDATE contacts SET status = 'read' WHERE contact_id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Contact not found' });
      return;
    }
    res.json({ success: true });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query(`DELETE FROM contacts WHERE contact_id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Contact not found' });
      return;
    }
    res.json({ success: true });
  }),
);

module.exports = router;
