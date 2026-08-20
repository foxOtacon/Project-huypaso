const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !message) {
      res.status(400).json({ success: false, message: "name, email and message are required" });
      return;
    }

    const result = await query(
      `INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)`,
      [name, email, subject || null, message],
    );

    const rows = await query(`SELECT * FROM contacts WHERE contact_id = ? LIMIT 1`, [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  }),
);

module.exports = router;
