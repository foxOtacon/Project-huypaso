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
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 10000,
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 10000,
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 20000,
    });
  }
  return transporter;
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresMinutes }) {
  try {
    return await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "ตั้งรหัสผ่านใหม่ - สินค้าชุมชน",
      text: `สวัสดี ${name || "ผู้ใช้งาน"}\n\nตั้งรหัสผ่านใหม่ได้ที่: ${resetUrl}\nลิงก์มีอายุ ${expiresMinutes} นาทีและใช้ได้ครั้งเดียว`,
    });
  } catch (error) {
    console.error("[PASSWORD RESET EMAIL]", { code: error.code, command: error.command, responseCode: error.responseCode });
    if (error.status) throw error;
    if (error.code === "EAUTH" || error.responseCode === 535) {
      error.status = 502;
      error.code = "SMTP_AUTH_FAILED";
      error.message = "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบ SMTP_USER และ Google App Password บน Render";
    } else if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED"].includes(error.code)) {
      error.status = 504;
      error.code = "SMTP_CONNECTION_FAILED";
      error.message = "เชื่อมต่อเซิร์ฟเวอร์อีเมลไม่สำเร็จ กรุณาตรวจสอบ SMTP_HOST, SMTP_PORT และ SMTP_SECURE";
    } else {
      error.status = 502;
      error.code = "SMTP_SEND_FAILED";
      error.message = "ผู้ให้บริการอีเมลปฏิเสธการส่ง กรุณาตรวจสอบค่า SMTP บน Render";
    }
    throw error;
  }
}

module.exports = { sendPasswordResetEmail };
