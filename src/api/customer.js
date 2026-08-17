const API_BASE = import.meta.env.VITE_API_URL || '/api';

import { handleInvalidSession } from '../utils/session';

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidSession(response, data);
    throw new Error(data.message || 'Unable to load account data');
  }

  return data;
}

export async function fetchMyOrders(token) {
  const res = await request('/orders/my', token);
  return res.data || [];
}
export async function fetchMyOrderDetail(token, orderId) {
  const res = await request(`/orders/my/${orderId}`, token);
  return res.data;
}

export async function cancelMyOrder(token, orderId) {
  const res = await request(`/payment/order/${orderId}`, token, { method: 'DELETE' });
  return res.data;
}
