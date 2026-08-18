const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    const error = new Error("Password reset email is not configured");
    error.status = 503;
    throw error;
  }
  if (!transporter) {
    const port = Number(SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === "true" || port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresMinutes }) {
  return getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "ตั้งรหัสผ่านใหม่ - สินค้าชุมชน",
    text: `สวัสดี ${name || "ผู้ใช้งาน"}\n\nตั้งรหัสผ่านใหม่ได้ที่: ${resetUrl}\nลิงก์มีอายุ ${expiresMinutes} นาทีและใช้ได้ครั้งเดียว`,
  });
}

module.exports = { sendPasswordResetEmail };
