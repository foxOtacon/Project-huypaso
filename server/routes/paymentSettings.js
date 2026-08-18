const express = require("express");
const multer = require("multer");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const paymentSettingsModel = require("../models/paymentSettingsModel");
const { deleteStoredImage, uploadImage } = require('../services/storageService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    const error = new Error("รองรับเฉพาะรูป QR Code ชนิด JPG, PNG และ WebP");
    error.status = 400;
    cb(error);
  },
});

router.get("/", asyncHandler(async (_req, res) => {
  const settings = await paymentSettingsModel.getPaymentSettings();
  res.json({ success: true, data: settings });
}));

router.put("/", authenticate, authorize("admin"), upload.single("qr"), asyncHandler(async (req, res) => {
  const promptpayNumber = String(req.body.promptpay_number || "").trim();
  const accountName = String(req.body.account_name || "").trim();
  const bankName = String(req.body.bank_name || "").trim();
  const bankAccountNumber = String(req.body.bank_account_number || "").trim();
  const bankAccountName = String(req.body.bank_account_name || "").trim();
  const hasPromptPayText = Boolean(promptpayNumber || accountName);
  const hasCompletePromptPay = Boolean(promptpayNumber && accountName);
  const hasBankText = Boolean(bankName || bankAccountNumber || bankAccountName);
  const hasCompleteBank = Boolean(bankName && bankAccountNumber && bankAccountName);
  if ((hasPromptPayText && !hasCompletePromptPay) || (hasBankText && !hasCompleteBank)) {
    res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลของช่องทางการชำระเงินที่เลือกให้ครบทุกช่อง" });
    return;
  }
  const existing = await paymentSettingsModel.getPaymentSettings();
  if (hasCompletePromptPay && !req.file && !existing?.qr_image_url) {
    res.status(400).json({ success: false, message: "กรุณาอัปโหลดรูป QR Code พร้อมเพย์" });
    return;
  }
  const qrImageUrl = req.file
    ? await uploadImage({
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
        fileName: req.file.originalname,
        folder: 'payment-settings',
        extension: req.file.mimetype === 'image/webp' ? 'webp' : req.file.mimetype === 'image/png' ? 'png' : 'jpg',
      })
    : null;
  const settings = await paymentSettingsModel.updatePaymentSettings({
    promptpayNumber,
    accountName,
    qrImageUrl,
    bankName,
    bankAccountNumber,
    bankAccountName,
    updatedBy: req.user.user_id,
  });
  if (!settings) {
    const error = new Error("บันทึกการตั้งค่าการชำระเงินแล้ว แต่ไม่สามารถโหลดข้อมูลล่าสุดได้");
    error.status = 500;
    throw error;
  }
  if (req.file && existing?.qr_image_url !== settings.qr_image_url) {
    await deleteStoredImage(existing?.qr_image_url);
  }
  res.json({ success: true, data: settings });
}));

module.exports = router;
