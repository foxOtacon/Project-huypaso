const { validationResult } = require("express-validator");
const paymentService = require("../services/paymentService");

function handleValidation(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) return false;

  const details = errors.array().map((error) => error.msg).filter(Boolean);

  res.status(400).json({
    success: false,
    message: details.length ? details.join(", ") : "Validation failed",
    errors: errors.array(),
  });
  return true;
}

async function createOrder(req, res) {
  if (handleValidation(req, res)) return;

  const order = await paymentService.createOrder(req.user, req.body);
  res.status(201).json({ success: true, data: order });
}

async function getPromptPayQr(req, res) {
  if (handleValidation(req, res)) return;

  const data = await paymentService.generatePromptPayQr(req.user, req.params.orderId);
  res.json(data);
}

async function uploadSlip(req, res) {
  if (handleValidation(req, res)) return;

  await paymentService.uploadSlip({
    user: req.user,
    orderId: req.body.orderId,
    file: req.file,
    paymentMethod: req.body.paymentMethod || "promptpay",
  });

  res.status(201).json({
    success: true,
    message: "Upload Success",
  });
}

async function cancelOrder(req, res) {
  if (handleValidation(req, res)) return;
  const order = await paymentService.cancelOrder(req.user, req.params.orderId);
  res.json({
    success: true,
    message: order.already_cancelled ? "Order was already cancelled" : "Order cancelled",
    data: order,
  });
}

async function listAdminPayments(_req, res) {
  const payments = await paymentService.listAdminPayments();
  res.json({ success: true, data: payments });
}

async function approvePayment(req, res) {
  if (handleValidation(req, res)) return;

  const payment = await paymentService.approvePayment(req.params.id);
  res.json({ success: true, data: payment });
}

async function rejectPayment(req, res) {
  if (handleValidation(req, res)) return;

  const payment = await paymentService.rejectPayment(req.params.id);
  res.json({ success: true, data: payment });
}

module.exports = {
  createOrder,
  getPromptPayQr,
  uploadSlip,
  cancelOrder,
  listAdminPayments,
  approvePayment,
  rejectPayment,
};
