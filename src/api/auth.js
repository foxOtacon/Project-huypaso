import { handleInvalidSession } from '../utils/session';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const pendingMeRequests = new Map();

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
    const error = new Error(data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

export async function requestPasswordReset(email) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);
  try {
    return await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('ระบบส่งอีเมลใช้เวลานานเกินไป กรุณาตรวจสอบการตั้งค่า SMTP แล้วลองใหม่');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function resetPassword(token, password) {
  return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export async function loginWithGoogle(credential) {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function getGoogleRedirectLoginUrl() {
  return `${API_BASE}/auth/google/start`;
}

export async function register({ full_name, email, password, phone, address }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email, password, phone, address }),
  });
}

export async function getMe(token) {
  if (pendingMeRequests.has(token)) {
    return pendingMeRequests.get(token);
  }

  const requestPromise = request('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  pendingMeRequests.set(token, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingMeRequests.delete(token);
  }
}

export async function updateMe(token, payload) {
  return request('/auth/me', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
