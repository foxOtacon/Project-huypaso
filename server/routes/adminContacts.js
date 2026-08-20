const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT * FROM contacts ORDER BY created_at DESC`,
    );

    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const rows = await query(`SELECT * FROM contacts WHERE contact_id = ? LIMIT 1`, [req.params.id]);
    const item = rows[0] || null;

    if (!item) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    res.json({ success: true, data: item });
  }),
);

router.put(
  "/:id/read",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await query("UPDATE contacts SET status = 'read' WHERE contact_id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    const rows = await query(`SELECT * FROM contacts WHERE contact_id = ? LIMIT 1`, [req.params.id]);
    res.json({ success: true, data: rows[0] });
  }),
);

module.exports = router;
