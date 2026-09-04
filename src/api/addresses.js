const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'ไม่สามารถจัดการที่อยู่ได้');
  return data;
}

export async function fetchAddresses(token) {
  const response = await request('/user-addresses', token);
  return response.data || [];
}

export async function createAddress(token, payload) {
  const response = await request('/user-addresses', token, { method: 'POST', body: JSON.stringify(payload) });
  return response.data;
}

export async function updateAddress(token, addressId, payload) {
  const response = await request(`/user-addresses/${addressId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  return response.data;
}

export async function setDefaultAddress(token, addressId) {
  return request(`/user-addresses/${addressId}/default`, token, { method: 'PUT', body: JSON.stringify({}) });
}

export async function deleteAddress(token, addressId) {
  return request(`/user-addresses/${addressId}`, token, { method: 'DELETE' });
}