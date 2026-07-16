const INVALID_SESSION_CODES = new Set([
  'SESSION_INVALID',
  'TOKEN_EXPIRED_OR_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
]);

const SESSION_MESSAGES = {
  TOKEN_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  TOKEN_INVALID: 'Token ไม่ถูกต้องหรือ Server มีการเปลี่ยนคีย์ กรุณาเข้าสู่ระบบใหม่',
  SESSION_INVALID: 'ไม่พบบัญชีที่สัมพันธ์กับเซสชันนี้ กรุณาเข้าสู่ระบบใหม่',
};

let invalidSessionHandled = false;

export function handleInvalidSession(response, data = {}) {
  if (response.status !== 401 || !INVALID_SESSION_CODES.has(data.code)) {
    return false;
  }

  if (invalidSessionHandled) return true;
  invalidSessionHandled = true;

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  const message = SESSION_MESSAGES[data.code] ||
    'เซสชันหมดอายุหรือข้อมูลบัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่';
  sessionStorage.setItem('auth_message', message);
  console.warn('[AUTH]', { code: data.code, status: response.status });
  window.dispatchEvent(new CustomEvent('auth:session-invalid'));
  return true;
}

export function resetInvalidSessionState() {
  invalidSessionHandled = false;
}
