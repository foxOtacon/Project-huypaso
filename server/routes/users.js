const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeUser } = require("../utils/userHelper");

const router = express.Router();

const USER_HAS_REFERENCES_MESSAGE =
  'ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีสินค้า คำสั่งซื้อ หรือประวัติการใช้งานเชื่อมโยงอยู่ กรุณาระงับบัญชีแทนการลบ';

const USER_FIELDS = [
  "full_name",
  "email",
  "password_hash",
  "role",
  "phone",
  "address",
  "status",
];

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT * FROM users ORDER BY user_id DESC");
    res.json({ success: true, data: rows.map(sanitizeUser) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const rows = await query("SELECT * FROM users WHERE user_id = ?", [req.params.id]);

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, data: sanitizeUser(rows[0]) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { full_name, email, password, role, phone, address, status } = req.body;

    if (!full_name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "full_name, email, and password are required",
      });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role, phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        password_hash,
        role || "customer",
        phone || null,
        address || null,
        status || "active",
      ]
    );

    const rows = await query("SELECT * FROM users WHERE user_id = ?", [result.insertId]);
    res.status(201).json({ success: true, data: sanitizeUser(rows[0]) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = {};

    for (const field of USER_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "password")) {
      payload.password_hash = await bcrypt.hash(req.body.password, 10);
    }

    delete payload.password;

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }

    const columns = Object.keys(payload);
    const assignments = columns.map((column) => `${column} = ?`).join(", ");
    const values = [...columns.map((column) => payload[column]), req.params.id];

    const result = await query(
      `UPDATE users SET ${assignments} WHERE user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const rows = await query("SELECT * FROM users WHERE user_id = ?", [req.params.id]);
    res.json({ success: true, data: sanitizeUser(rows[0]) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    let result;

    try {
      result = await query("DELETE FROM users WHERE user_id = ?", [req.params.id]);
    } catch (error) {
      if (
        error.code === "23503" ||
        error.code === "ER_ROW_IS_REFERENCED_2" ||
        error.code === "ER_NO_REFERENCED_ROW_2"
      ) {
        res.status(409).json({
          success: false,
          code: "USER_HAS_REFERENCES",
          message: USER_HAS_REFERENCES_MESSAGE,
        });
        return;
      }

      throw error;
    }

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, message: "User deleted successfully" });
  })
);

module.exports = router;
