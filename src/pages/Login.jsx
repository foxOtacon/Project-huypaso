import { useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { getGoogleRedirectLoginUrl, login } from '../api/auth';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const ERROR_MESSAGES = {
  'email and password are required': 'กรุณากรอกอีเมลและรหัสผ่าน',
  'Invalid email or password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Account is suspended': 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
  'Google login is not configured': 'ยังไม่ได้ตั้งค่า Google Login',
  'Invalid Google credential': 'ไม่สามารถยืนยันบัญชี Google ได้',
  'Google account email is not verified': 'อีเมล Google ยังไม่ได้ยืนยัน',
};

function translateError(message) {
  return ERROR_MESSAGES[message] || message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

function readSessionMessage() {
  const message = sessionStorage.getItem('auth_message') || '';
  sessionStorage.removeItem('auth_message');
  return message;
}

export default function Login({ onNavigate, onSuccess, variant, onClose }) {
  const { loginSuccess } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(readSessionMessage);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      const res = await login(email.trim(), password);
      loginSuccess(res.data);
      onSuccess?.(res.data.user);
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="เข้าสู่ระบบ"
      subtitle="ยินดีต้อนรับกลับมา กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ"
      variant={variant}
      onClose={onClose}
    >
      {error && (
        <Alert variant="danger" className="auth-alert">
          {error}
        </Alert>
      )}

      <Form className="auth-form" onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="loginEmail">
          <Form.Label>อีเมล</Form.Label>
          <Form.Control
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="loginPassword">
          <Form.Label>รหัสผ่าน</Form.Label>
          <div className="auth-password-field">
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
            >
              {showPassword ? 'ซ่อน' : 'ดู'}
            </button>
          </div>
        </Form.Group>

        <p className="auth-footer auth-forgot-link">
          <a href="#/forgot-password" onClick={(e) => { e.preventDefault(); onNavigate('/forgot-password'); }}>ลืมรหัสผ่าน?</a>
        </p>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </Form>

      <div className="auth-divider">
        <span>หรือ</span>
      </div>

      <button
        type="button"
        className="google-login-button"
        onClick={() => {
          window.location.href = getGoogleRedirectLoginUrl();
        }}
      >
        <span aria-hidden="true">G</span>
        เข้าสู่ระบบด้วย Google
      </button>

      <p className="auth-footer">
        ยังไม่มีบัญชี?{' '}
        <a
          href="#/register"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/register');
          }}
        >
          สมัครสมาชิก
        </a>
      </p>
    </AuthLayout>
  );
}
