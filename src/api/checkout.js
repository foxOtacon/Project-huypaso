
const BACKEND_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');
import { handleInvalidSession } from '../utils/session';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidSession(response, data);
    const validationDetails = Array.isArray(data.errors)
      ? data.errors.map((error) => error.path || error.param || error.msg).filter(Boolean).join(', ')
      : '';
    const message = validationDetails ? `${data.message}: ${validationDetails}` : data.message;
    throw new Error(message || 'Unable to save payment information');
  }

  return data;
}

export async function createOrder(payload) {
  const res = await request('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function createOrderItem(payload) {
  const res = await request('/order-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function createPayment(payload) {
  const res = await request('/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function checkout(token, payload) {
  const res = await request('/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function createPromptPayOrder(token, payload) {
  const res = await request('/payment/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchPromptPayQr(orderId) {
  return request(`/payment/promptpay/${orderId}`);
}

export async function cancelPromptPayOrder(token, orderId) {
  const res = await request(`/payment/order/${orderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function uploadPromptPaySlip(token, { orderId, paymentMethod, file }) {
  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('paymentMethod', paymentMethod);
  formData.append('slip', file);

  const response = await fetch(`${API_BASE}/payment/upload-slip`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidSession(response, data);
    const validationDetails = Array.isArray(data.errors)
      ? data.errors.map((error) => error.path || error.param || error.msg).filter(Boolean).join(', ')
      : '';
    const message = validationDetails ? `${data.message}: ${validationDetails}` : data.message;
    throw new Error(message || 'Unable to save payment information');
  }

  return data;
}

export async function uploadPaymentSlip({ fileName, dataUrl }) {
  const res = await request('/uploads/payment-slip', {
    method: 'POST',
    body: JSON.stringify({ fileName, dataUrl }),
  });
  return res.data;
}
