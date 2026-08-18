import { useMemo, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { resetPassword } from '../api/auth';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword({ route, onNavigate, variant, onClose }) {
  const token = useMemo(() => new URLSearchParams(route.split('?')[1] || '').get('token') || '', [route]);
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(token ? '' : 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง');
  const [success, setSuccess] = useState(false); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setError('');
    if (password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (password !== confirm) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    setLoading(true); try { await resetPassword(token, password); setSuccess(true); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <AuthLayout title="ตั้งรหัสผ่านใหม่" subtitle="กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ" variant={variant} onClose={onClose}>
    {success && <Alert variant="success" className="auth-alert">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว</Alert>}{error && <Alert variant="danger" className="auth-alert">{error}</Alert>}
    {!success && <Form className="auth-form" onSubmit={submit}>
      <Form.Group className="mb-3"><Form.Label>รหัสผ่านใหม่</Form.Label><Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={loading || !token} /></Form.Group>
      <Form.Group className="mb-3"><Form.Label>ยืนยันรหัสผ่านใหม่</Form.Label><Form.Control type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading || !token} /></Form.Group>
      <button type="submit" className="auth-submit" disabled={loading || !token}>{loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</button>
    </Form>}
    <p className="auth-footer"><a href="#/login" onClick={(e) => { e.preventDefault(); onNavigate('/login'); }}>กลับไปหน้าเข้าสู่ระบบ</a></p>
  </AuthLayout>;
}
