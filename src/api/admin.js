const API_BASE = import.meta.env.VITE_API_URL || '/api';

import { handleInvalidSession } from '../utils/session';

const pendingGetRequests = new Map();

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function performRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    const error = new Error('กรุณาเข้าสู่ระบบใหม่');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidSession(response, data);
    const error = new Error(data.message || 'ไม่สามารถโหลดข้อมูลได้');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    return performRequest(path, options);
  }

  const token = localStorage.getItem('token') || '';
  const requestKey = `${token}:${path}`;

  if (pendingGetRequests.has(requestKey)) {
    return pendingGetRequests.get(requestKey);
  }

  const requestPromise = performRequest(path, options);
  pendingGetRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingGetRequests.delete(requestKey);
  }
}

export async function fetchOrders() {
  const res = await request('/orders');
  return res.data || [];
}

export async function fetchUsers() {
  const res = await request('/users');
  return res.data || [];
}

export async function updateUser(userId, payload) {
  const res = await request(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteUser(userId) {
  const res = await request(`/users/${userId}`, {
    method: 'DELETE',
  });
  return res;
}

export async function fetchPayments() {
  const res = await request('/payments');
  return res.data || [];
}

export async function fetchOrderItems() {
  const res = await request('/order-items');
  return res.data || [];
}

export async function fetchProducts() {
  const res = await request('/products/admin/all');
  return res.data || [];
}


export async function fetchShippingCarriers() {
  const res = await request('/shipping-carriers');
  return res.data || [];
}

export async function createShippingCarrier(payload) {
  const res = await request('/shipping-carriers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateShippingCarrier(carrierId, payload) {
  const res = await request(`/shipping-carriers/${carrierId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteShippingCarrier(carrierId) {
  return request(`/shipping-carriers/${carrierId}`, {
    method: 'DELETE',
  });
}

export async function fetchCategories() {
  const res = await request('/categories');
  return res.data || [];
}

export async function createCategory(payload) {
  const res = await request('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCategory(categoryId, payload) {
  const res = await request(`/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteCategory(categoryId) {
  return request(`/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export async function fetchSalesPredictions() {
  const res = await request('/sales-prediction');
  return res.data || [];
}

export async function fetchLatestAnalysis() {
  const res = await request('/admin/analytics/latest');
  return res.data || { run: null, predictions: [] };
}

export async function fetchAnalysisRunStatus(runId) {
  const res = await request(`/admin/analytics/status/${encodeURIComponent(runId)}`);
  return res.data || null;
}

export async function startAnalysis(payload = {}) {
  const res = await request('/admin/analytics/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function createProduct(payload) {
  const res = await request('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateProduct(productId, payload) {
  const res = await request(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteProduct(productId) {
  const res = await request(`/products/${productId}`, {
    method: 'DELETE',
  });
  return res;
}

export async function uploadProductImage({ fileName, dataUrl }) {
  const res = await request('/uploads/product-image', {
    method: 'POST',
    body: JSON.stringify({ fileName, dataUrl }),
  });
  return res.data;
}

export async function uploadNewsImage({ fileName, dataUrl }) {
  const res = await request('/uploads/news-image', {
    method: 'POST',
    body: JSON.stringify({ fileName, dataUrl }),
  });
  return res.data;
}

export async function updateOrder(orderId, payload) {
  const res = await request(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updatePayment(paymentId, payload) {
  const res = await request(`/payments/${paymentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchAdminPayments() {
  const res = await request('/admin/payments');
  return res.data || [];
}

export async function approveAdminPayment(paymentId) {
  const res = await request(`/admin/payment/${paymentId}/approve`, {
    method: 'PUT',
  });
  return res.data;
}

export async function rejectAdminPayment(paymentId) {
  const res = await request(`/admin/payment/${paymentId}/reject`, {
    method: 'PUT',
  });
  return res.data;
}

export async function fetchPaymentSettings() {
  const res = await request('/payment-settings');
  return res.data;
}

export async function savePaymentSettings({ promptpayNumber, accountName, qrFile, bankName, bankAccountNumber, bankAccountName }) {
  const formData = new FormData();
  formData.append('promptpay_number', promptpayNumber);
  formData.append('account_name', accountName);
  if (qrFile) formData.append('qr', qrFile);
  formData.append('bank_name', bankName);
  formData.append('bank_account_number', bankAccountNumber);
  formData.append('bank_account_name', bankAccountName);
  const response = await fetch(`${API_BASE}/payment-settings`, { method: 'PUT', headers: getAuthHeaders(), body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { handleInvalidSession(response, data); throw new Error(data.message || 'ไม่สามารถบันทึกการตั้งค่าการชำระเงินได้'); }
  return data.data;
}

export async function fetchNews() {
  const res = await request('/news/admin/all');
  return res.data || [];
}

export async function createNews(payload) {
  const res = await request('/news', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateNews(newsId, payload) {
  const res = await request(`/news/${newsId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteNews(newsId) {
  const res = await request(`/news/${newsId}`, {
    method: 'DELETE',
  });
  return res;
}
export async function fetchHistoryContent() {
  const res = await request('/site-content/history');
  return res.data;
}

export async function updateHistoryContent(contentHtml) {
  const res = await request('/site-content/history', {
    method: 'PUT',
    body: JSON.stringify({ content_html: contentHtml }),
  });
  return res.data;
}
