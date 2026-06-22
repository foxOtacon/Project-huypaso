const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
    throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลได้');
  }

  return data;
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
  const res = await request('/products');
  return res.data || [];
}

export async function fetchCategories() {
  const res = await request('/categories');
  return res.data || [];
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
