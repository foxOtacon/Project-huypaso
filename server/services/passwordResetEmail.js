const nodemailer = require("nodemailer");

let transporter;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendWithResend({ to, name, resetUrl, expiresMinutes }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number(process.env.RESEND_TIMEOUT_MS) || 15000);
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "project-huypaso/1.0",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "สินค้าชุมชน <onboarding@resend.dev>",
        to: [to],
        subject: "ตั้งรหัสผ่านใหม่ - สินค้าชุมชน",
        text: `สวัสดี ${name || "ผู้ใช้งาน"}\n\nตั้งรหัสผ่านใหม่ได้ที่: ${resetUrl}\nลิงก์มีอายุ ${expiresMinutes} นาทีและใช้ได้ครั้งเดียว`,
        html: `<p>สวัสดี ${escapeHtml(name || "ผู้ใช้งาน")}</p><p>ตั้งรหัสผ่านใหม่ได้จากลิงก์ด้านล่าง</p><p><a href="${escapeHtml(resetUrl)}">ตั้งรหัสผ่านใหม่</a></p><p>ลิงก์มีอายุ ${expiresMinutes} นาทีและใช้ได้ครั้งเดียว</p>`,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const resendError = new Error(error.name === "AbortError" ? "Resend ใช้เวลาตอบกลับนานเกินไป" : "เชื่อมต่อ Resend ไม่สำเร็จ");
    resendError.status = 504;
    resendError.code = "RESEND_CONNECTION_FAILED";
    throw resendError;
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[RESEND EMAIL]", { status: response.status, name: result.name, message: result.message });
    const error = new Error(result.message || "Resend ปฏิเสธการส่งอีเมล");
    error.status = 502;
    error.code = "RESEND_SEND_FAILED";
    throw error;
  }
  return result;
}

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
  const provider = String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "smtp")).toLowerCase();

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      const error = new Error("ยังไม่ได้ตั้งค่า RESEND_API_KEY");
      error.status = 503;
      error.code = "RESEND_NOT_CONFIGURED";
      throw error;
    }
    return sendWithResend({ to, name, resetUrl, expiresMinutes });
  }

  if (provider !== "smtp") {
    const error = new Error("EMAIL_PROVIDER ต้องเป็น resend หรือ smtp");
    error.status = 500;
    error.code = "INVALID_EMAIL_PROVIDER";
    throw error;
  }

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
