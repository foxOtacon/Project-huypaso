const express = require("express");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !message) {
      const error = new Error('Missing required fields');
      error.status = 400;
      throw error;
    }

    const result = await query(
      `INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)`,
      [name, email, subject || null, message],
    );

    res.json({ success: true, data: { contact_id: result.insertId } });
  }),
);

module.exports = router;
