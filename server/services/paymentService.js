const generatePayload = require("promptpay-qr");
const QRCode = require("qrcode");
const paymentModel = require("../models/paymentModel");
const {
  PAYMENT_EXPIRATION_MINUTES,
  cancelExpiredUnpaidOrders,
} = require("./orderExpirationService");

const PROMPTPAY_ID = process.env.PROMPTPAY_ID || "0634126252";

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

async function generatePromptPayQr(orderId) {
  await cancelExpiredUnpaidOrders();
  const order = await paymentModel.getOrderById(orderId);

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

  if (amount < 20) {
    const error = new Error("PromptPay payment amount must be at least 20 THB");
    error.status = 400;
    throw error;
  }

  const expiredAtDate = new Date(
    new Date(order.order_date).getTime() + PAYMENT_EXPIRATION_MINUTES * 60 * 1000,
  );
  const expiresInSeconds = Math.max(
    0,
    Math.ceil((expiredAtDate.getTime() - Date.now()) / 1000),
  );
  const expiredAt = expiredAtDate.toISOString();
  const payload = generatePayload(PROMPTPAY_ID, { amount });
  const qrCode = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
  });

  return {
    success: true,
    order_id: order.order_id,
    orderId: order.order_id,
    amount,
    promptPayId: PROMPTPAY_ID,
    qr_code: qrCode,
    qrCode,
    expired_at: expiredAt,
    expires_in_seconds: expiresInSeconds,
  };
}

async function uploadSlip({ orderId, file, paymentMethod = "promptpay" }) {
  await cancelExpiredUnpaidOrders();
  const order = await paymentModel.getOrderById(orderId);

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

  return paymentModel.createSlipPayment({
    orderId: order.order_id,
    amount: Number(order.total_amount || 0),
    slipImage: `/uploads/slips/${file.filename}`,
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

module.exports = {
  createOrder,
  generatePromptPayQr,
  uploadSlip,
  cancelOrder,
  listAdminPayments: paymentModel.listAdminPayments,
  approvePayment: paymentModel.approvePayment,
  rejectPayment: paymentModel.rejectPayment,
};
