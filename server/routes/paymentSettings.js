const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const paymentSettingsModel = require("../models/paymentSettingsModel");

const router = express.Router();
router.get("/", asyncHandler(async (_req, res) => {
  const settings = await paymentSettingsModel.getPaymentSettings();
  res.json({ success: true, data: settings });
}));

router.put("/", authenticate, authorize("admin"), asyncHandler(async (req, res) => {
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
  const settings = await paymentSettingsModel.updatePaymentSettings({
    promptpayNumber,
    accountName,
    qrImageUrl: null,
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
  res.json({ success: true, data: settings });
}));

module.exports = router;
