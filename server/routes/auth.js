const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool, query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/jwt");
const { sanitizeUser } = require("../utils/userHelper");
const { authenticate, getMe } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../services/passwordResetEmail");

const router = express.Router();
const RESET_RESPONSE = "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้คุณ";
let resetTablePromise;

function ensureResetTable() {
  if (!resetTablePromise) {
    resetTablePromise = query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      reset_token_id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch((error) => {
      resetTablePromise = null;
      if (error.code === "42501" || error.code === "42P01") {
        error.status = 503;
        error.code = "PASSWORD_RESET_TABLE_REQUIRED";
        error.message = "ยังไม่ได้ติดตั้งตาราง password_reset_tokens ในฐานข้อมูล";
      }
      throw error;
    });
  }
  return resetTablePromise;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function verifyGoogleCredential(credential) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    const error = new Error("Google login is not configured");
    error.status = 500;
    throw error;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );
  const profile = await response.json().catch(() => ({}));

  if (!response.ok || profile.aud !== googleClientId || !profile.email) {
    const error = new Error("Invalid Google credential");
    error.status = 401;
    throw error;
  }

  if (profile.email_verified !== "true" && profile.email_verified !== true) {
    const error = new Error("Google account email is not verified");
    error.status = 401;
    throw error;
  }

  return {
    email: profile.email,
    full_name: profile.name || profile.email,
    google_sub: profile.sub,
  };
}

function getGoogleRedirectUri(req) {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.protocol}://${req.get("host")}/api/auth/google/callback`
  );
}

function getClientAppUrl() {
  return process.env.CLIENT_APP_URL || "http://localhost:5173";
}

function redirectToGoogleError(res) {
  res.redirect(`${getClientAppUrl()}/#/auth/google/callback?error=google_login_failed`);
}

async function exchangeGoogleCodeForProfile(req, code) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    const error = new Error("Google login is not configured");
    error.status = 500;
    throw error;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: getGoogleRedirectUri(req),
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenData.id_token) {
    const error = new Error("Invalid Google credential");
    error.status = 401;
    throw error;
  }

  return verifyGoogleCredential(tokenData.id_token);
}

async function findOrCreateGoogleUser(googleProfile) {
  const existingRows = await query("SELECT * FROM users WHERE email = ?", [
    googleProfile.email,
  ]);

  let user = existingRows[0];

  if (user?.status === "suspended") {
    const error = new Error("Account is suspended");
    error.status = 403;
    throw error;
  }

  if (!user) {
    const password_hash = await bcrypt.hash(
      `google:${googleProfile.google_sub}:${Date.now()}`,
      10
    );

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role, phone, address, status)
       VALUES (?, ?, ?, 'customer', NULL, NULL, 'active')`,
      [googleProfile.full_name, googleProfile.email, password_hash]
    );

    const rows = await query("SELECT * FROM users WHERE user_id = ?", [result.insertId]);
    user = rows[0];
  }

  return user;
}

function buildAuthResponse(user) {
  const safeUser = sanitizeUser(user);

  return {
    user: safeUser,
    token: signToken({
      user_id: safeUser.user_id,
      email: safeUser.email,
      role: safeUser.role,
    }),
  };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { full_name, email, password, phone, address } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!full_name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "full_name, email, and password are required",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
      return;
    }

    const existingUsers = await query("SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ?", [normalizedEmail]);

    if (existingUsers.length > 0) {
      res.status(409).json({ success: false, message: "Email already registered" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role, phone, address, status)
       VALUES (?, ?, ?, 'customer', ?, ?, 'active')`,
      [String(full_name).trim(), normalizedEmail, password_hash, phone || null, address || null]
    );

    const rows = await query("SELECT * FROM users WHERE user_id = ?", [result.insertId]);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: buildAuthResponse(rows[0]),
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "email and password are required",
      });
      return;
    }

    const rows = await query("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?", [normalizedEmail]);

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ success: false, message: "Account is suspended" });
      return;
    }

    res.json({
      success: true,
      message: "Login successful",
      data: buildAuthResponse(user),
    });
  })
);

router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ success: false, message: "Google credential is required" });
      return;
    }

    const googleProfile = await verifyGoogleCredential(credential);
    const user = await findOrCreateGoogleUser(googleProfile);

    res.json({
      success: true,
      message: "Google login successful",
      data: buildAuthResponse(user),
    });
  })
);

router.post("/forgot-password", asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: "กรุณากรอกอีเมลให้ถูกต้อง" });
    return;
  }
  await ensureResetTable();
  const users = await query("SELECT user_id, full_name, email FROM users WHERE LOWER(TRIM(email)) = ? AND status = 'active'", [email]);
  if (users.length) {
    const user = users[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresMinutes = Math.max(5, Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) || 30);
    await query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [user.user_id]);
    await query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [user.user_id, hashResetToken(token), new Date(Date.now() + expiresMinutes * 60000)]);
    const appUrl = getClientAppUrl().replace(/\/$/, "");
    await sendPasswordResetEmail({ to: user.email, name: user.full_name, resetUrl: `${appUrl}/#/reset-password?token=${encodeURIComponent(token)}`, expiresMinutes });
  }
  res.json({ success: true, message: RESET_RESPONSE });
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token || password.length < 6) {
    res.status(400).json({ success: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    return;
  }
  await ensureResetTable();
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const tokens = await client.query(`SELECT reset_token_id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`, [hashResetToken(token)]);
    if (!tokens.length) {
      await client.rollback();
      res.status(400).json({ success: false, message: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" });
      return;
    }
    await client.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [await bcrypt.hash(password, 10), tokens[0].user_id]);
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE reset_token_id = ?", [tokens[0].reset_token_id]);
    await client.commit();
    res.json({ success: true, message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว" });
  } catch (error) {
    await client.rollback().catch(() => {});
    throw error;
  } finally { client.release(); }
}));

router.get("/google/start", (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    redirectToGoogleError(res);
    return;
  }

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      redirectToGoogleError(res);
      return;
    }

    try {
      const googleProfile = await exchangeGoogleCodeForProfile(req, code);
      const user = await findOrCreateGoogleUser(googleProfile);
      const authData = buildAuthResponse(user);
      const encodedUser = encodeURIComponent(JSON.stringify(authData.user));
      const params = new URLSearchParams({
        token: authData.token,
        user: encodedUser,
      });

      res.redirect(`${getClientAppUrl()}/#/auth/google/callback?${params.toString()}`);
    } catch {
      redirectToGoogleError(res);
    }
  })
);

router.get("/me", authenticate, getMe);

router.put(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const { full_name, email, phone, address, password } = req.body || {};
    const payload = {};

    if (full_name !== undefined) {
      const nextFullName = String(full_name).trim();

      if (!nextFullName) {
        res.status(400).json({ success: false, message: "full_name is required" });
        return;
      }

      payload.full_name = nextFullName;
    }

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();

      if (!nextEmail) {
        res.status(400).json({ success: false, message: "email is required" });
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        res.status(400).json({ success: false, message: "Invalid email" });
        return;
      }

      payload.email = nextEmail;
    }

    if (phone !== undefined) payload.phone = String(phone).trim() || null;
    if (address !== undefined) payload.address = String(address).trim() || null;

    if (password) {
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
        return;
      }

      payload.password_hash = await bcrypt.hash(password, 10);
    }

    if (payload.email) {
      const duplicateRows = await query(
        "SELECT user_id FROM users WHERE email = ? AND user_id <> ?",
        [payload.email, req.user.user_id]
      );

      if (duplicateRows.length > 0) {
        res.status(409).json({ success: false, message: "Email already registered" });
        return;
      }
    }

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }

    const columns = Object.keys(payload);
    const assignments = columns.map((column) => `${column} = ?`).join(", ");
    const values = [...columns.map((column) => payload[column]), req.user.user_id];

    const result = await query(`UPDATE users SET ${assignments} WHERE user_id = ?`, values);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const rows = await query("SELECT * FROM users WHERE user_id = ?", [req.user.user_id]);

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, data: sanitizeUser(rows[0]) });
  })
);

module.exports = router;
