import { useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { requestPasswordReset } from '../api/auth';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword({ onNavigate, variant, onClose }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!email.trim()) return setError('กรุณากรอกอีเมล');
    setLoading(true);
    try { const res = await requestPasswordReset(email); setMessage(res.message); }
    catch (err) { setError(err.message || 'ไม่สามารถส่งอีเมลได้'); }
    finally { setLoading(false); }
  }
  return <AuthLayout title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสผ่านใหม่" variant={variant} onClose={onClose}>
    {message && <Alert variant="success" className="auth-alert">{message}</Alert>}
    {error && <Alert variant="danger" className="auth-alert">{error}</Alert>}
    <Form className="auth-form" onSubmit={submit}>
      <Form.Group className="mb-3" controlId="forgotEmail"><Form.Label>อีเมล</Form.Label><Form.Control type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={loading || !!message} /></Form.Group>
      <button type="submit" className="auth-submit" disabled={loading || !!message}>{loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}</button>
    </Form>
    <p className="auth-footer"><a href="#/login" onClick={(e) => { e.preventDefault(); onNavigate('/login'); }}>กลับไปหน้าเข้าสู่ระบบ</a></p>
  </AuthLayout>;
}
