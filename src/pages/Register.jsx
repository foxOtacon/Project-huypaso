import { useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { register } from '../api/auth';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const ERROR_MESSAGES = {
  'full_name, email, and password are required': 'กรุณากรอกชื่อ-นามสกุล อีเมล และรหัสผ่าน',
  'Password must be at least 6 characters': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'Email already registered': 'อีเมลนี้ถูกใช้งานแล้ว',
};

function translateError(message) {
  return ERROR_MESSAGES[message] || message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

export default function Register({ onNavigate, onSuccess, variant, onClose }) {
  const { loginSuccess } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    street: '',
    subdistrict: '',
    district: '',
    province: '',
    postal_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildAddress() {
    return [
      form.street.trim() && `ถนน ${form.street.trim()}`,
      form.subdistrict.trim() && `ตำบล ${form.subdistrict.trim()}`,
      form.district.trim() && `อำเภอ ${form.district.trim()}`,
      form.province.trim() && `จังหวัด ${form.province.trim()}`,
      form.postal_code.trim() && `รหัสไปรษณีย์ ${form.postal_code.trim()}`,
    ]
      .filter(Boolean)
      .join(', ');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError('กรุณากรอกชื่อ-นามสกุล อีเมล และรหัสผ่าน');
      return;
    }

    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);

    try {
      const address = buildAddress();

      const res = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        address: address || undefined,
      });
      loginSuccess(res.data);
      onSuccess?.();
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="สมัครสมาชิก"
      subtitle="สร้างบัญชีเพื่อสั่งซื้อสินค้าชุมชนคุณภาพ"
      variant={variant}
      onClose={onClose}
    >
      {error && (
        <Alert variant="danger" className="auth-alert">
          {error}
        </Alert>
      )}

      <Form className="auth-form" onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="registerName">
          <Form.Label>ชื่อ-นามสกุล</Form.Label>
          <Form.Control
            type="text"
            placeholder="ชื่อ นามสกุล"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="registerEmail">
          <Form.Label>อีเมล</Form.Label>
          <Form.Control
            type="email"
            placeholder="example@email.com"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="registerPhone">
          <Form.Label>
            เบอร์โทรศัพท์ 
          </Form.Label>
          <Form.Control
            type="tel"
            placeholder="08x-xxx-xxxx"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            autoComplete="tel"
            disabled={loading}
          />
        </Form.Group>

        <div className="auth-address-grid">
          <Form.Group className="mb-3 auth-field-wide" controlId="registerStreet">
            <Form.Label>ถนน</Form.Label>
            <Form.Control
              type="text"
              placeholder="เช่น ถนนห้วยหยวก"
              value={form.street}
              onChange={(e) => updateField('street', e.target.value)}
              autoComplete="street-address"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="registerSubdistrict">
            <Form.Label>ตำบล</Form.Label>
            <Form.Control
              type="text"
              placeholder="ตำบล"
              value={form.subdistrict}
              onChange={(e) => updateField('subdistrict', e.target.value)}
              autoComplete="address-level3"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="registerDistrict">
            <Form.Label>อำเภอ</Form.Label>
            <Form.Control
              type="text"
              placeholder="อำเภอ"
              value={form.district}
              onChange={(e) => updateField('district', e.target.value)}
              autoComplete="address-level2"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="registerProvince">
            <Form.Label>จังหวัด</Form.Label>
            <Form.Control
              type="text"
              placeholder="จังหวัด"
              value={form.province}
              onChange={(e) => updateField('province', e.target.value)}
              autoComplete="address-level1"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="registerPostalCode">
            <Form.Label>รหัสไปรษณีย์</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="00000"
              value={form.postal_code}
              onChange={(e) => updateField('postal_code', e.target.value.replace(/\D/g, ''))}
              autoComplete="postal-code"
              disabled={loading}
            />
          </Form.Group>
        </div>

        <Form.Group className="mb-3" controlId="registerPassword">
          <Form.Label>รหัสผ่าน</Form.Label>
          <div className="auth-password-field">
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              autoComplete="new-password"
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

        <Form.Group className="mb-3" controlId="registerConfirmPassword">
          <Form.Label>ยืนยันรหัสผ่าน</Form.Label>
          <div className="auth-password-field">
            <Form.Control
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              disabled={loading}
            >
              {showConfirmPassword ? 'ซ่อน' : 'ดู'}
            </button>
          </div>
        </Form.Group>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>
      </Form>

      <p className="auth-footer">
        มีบัญชีอยู่แล้ว?{' '}
        <a
          href="#/login"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/login');
          }}
        >
          เข้าสู่ระบบ
        </a>
      </p>
    </AuthLayout>
  );
}
