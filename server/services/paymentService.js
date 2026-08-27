const paymentModel = require("../models/paymentModel");
const paymentSettingsModel = require("../models/paymentSettingsModel");
const { query } = require("../config/db");
const { createSignedImageUrl, uploadImage } = require('./storageService');
const generatePromptPayPayload = require("promptpay-qr");
const QRCode = require("qrcode");
const {
  PAYMENT_EXPIRATION_MINUTES,
  cancelExpiredUnpaidOrders,
} = require("./orderExpirationService");

async function getActiveBankTransferAccounts() {
  await query(`CREATE TABLE IF NOT EXISTS bank_transfer_accounts (
    bank_transfer_account_id BIGSERIAL PRIMARY KEY,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  return query(`SELECT bank_transfer_account_id, bank_name, account_number, account_name
    FROM bank_transfer_accounts WHERE status = 'active' ORDER BY bank_transfer_account_id DESC`);
}
function assertCustomer(user) {
  if (user?.role !== "customer" && user?.role !== "user") {
    const error = new Error("Only customer users can use payment checkout");
    error.status = 403;
    throw error;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Cart items are required");
    error.status = 400;
    throw error;
  }

  return items.map((item) => {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error("Invalid cart item");
      error.status = 400;
      throw error;
    }

    return { product_id: productId, quantity };
  });
}

async function createOrder(user, body) {
  assertCustomer(user);

  return paymentModel.createOrderWithItems({
    userId: user.user_id,
    items: normalizeItems(body.items),
    shippingName: body.shipping_name.trim(),
    shippingPhone: body.shipping_phone.trim(),
    shippingAddress: body.shipping_address.trim(),
  });
}

async function generatePromptPayQr(user, orderId) {
  assertCustomer(user);
  await cancelExpiredUnpaidOrders();
  const order = await paymentModel.getOrderForUser(orderId, user.user_id);

  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }

  if (order.order_status === "cancelled") {
    const error = new Error("Order expired because no payment slip was uploaded");
    error.status = 410;
    throw error;
  }

  const amount = Number(order.total_amount || 0);

  const expiredAtDate = new Date(
    new Date(order.order_date).getTime() + PAYMENT_EXPIRATION_MINUTES * 60 * 1000,
  );
  const expiresInSeconds = Math.max(
    0,
    Math.ceil((expiredAtDate.getTime() - Date.now()) / 1000),
  );
  const expiredAt = expiredAtDate.toISOString();
  const settings = await paymentSettingsModel.getPaymentSettings();
  const hasPromptPay = Boolean(settings?.promptpay_number && settings?.account_name);
  const bankAccounts = await getActiveBankTransferAccounts();
  const availableBankAccounts = bankAccounts;
  const hasBankTransfer = availableBankAccounts.length > 0;
  if (!hasPromptPay && !hasBankTransfer) {
    const error = new Error("Payment settings are not configured");
    error.status = 503;
    throw error;
  }

  const promptPayPayload = hasPromptPay
    ? generatePromptPayPayload(settings.promptpay_number, { amount })
    : null;
  const qrCode = promptPayPayload
    ? await QRCode.toDataURL(promptPayPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      })
    : null;
  return {
    success: true,
    order_id: order.order_id,
    orderId: order.order_id,
    amount,
    promptPayId: settings.promptpay_number,
    promptpay_number: settings.promptpay_number,
    account_name: settings.account_name,
    bank_accounts: availableBankAccounts,
    qr_code: qrCode,
    qrCode: qrCode,
    expired_at: expiredAt,
    expires_in_seconds: expiresInSeconds,
    available_methods: { promptpay: hasPromptPay, bank_transfer: hasBankTransfer },
  };
}

async function uploadSlip({ user, orderId, file, paymentMethod = "promptpay" }) {
  assertCustomer(user);
  await cancelExpiredUnpaidOrders();
  const order = await paymentModel.getOrderForUser(orderId, user.user_id);

  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }

  if (order.order_status === "cancelled") {
    const error = new Error("Order expired because no payment slip was uploaded");
    error.status = 410;
    throw error;
  }

  if (!file) {
    const error = new Error("Slip image is required");
    error.status = 400;
    throw error;
  }

  const extension = file.mimetype === 'image/png' ? 'png' : 'jpg';
  const slipImage = await uploadImage({
    buffer: file.buffer,
    contentType: file.mimetype,
    fileName: file.originalname,
    folder: 'slips',
    extension,
  });

  return paymentModel.createSlipPayment({
    orderId: order.order_id,
    userId: user.user_id,
    amount: Number(order.total_amount || 0),
    slipImage,
    paymentMethod,
  });
}

async function cancelOrder(user, orderId) {
  assertCustomer(user);
  return paymentModel.cancelPendingOrderForUser({
    orderId: Number(orderId),
    userId: user.user_id,
  });
}

async function listAdminPayments() {
  const payments = await paymentModel.listAdminPayments();
  return Promise.all(payments.map(async (payment) => ({
    ...payment,
    slip_image: payment.slip_image ? await createSignedImageUrl(payment.slip_image) : null,
  })));
}

module.exports = {
  createOrder,
  generatePromptPayQr,
  uploadSlip,
  cancelOrder,
  listAdminPayments,
  approvePayment: paymentModel.approvePayment,
  rejectPayment: paymentModel.rejectPayment,
};
