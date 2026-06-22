import { useState } from 'react';
import { updateMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

const PROFILE_ERROR_MESSAGES = {
  'Email already registered': 'อีเมลนี้ถูกใช้งานแล้ว',
  'Password must be at least 6 characters': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'full_name is required': 'กรุณากรอกชื่อ-นามสกุล',
  'email is required': 'กรุณากรอกอีเมล',
  'Invalid email': 'รูปแบบอีเมลไม่ถูกต้อง',
  'No valid fields to update': 'ไม่มีข้อมูลสำหรับบันทึก',
  Unauthorized: 'กรุณาเข้าสู่ระบบอีกครั้ง',
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ProfilePage({ user, onNavigate, onLogout }) {
  const { token, updateCurrentUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const profileInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };

    setMessage('');
    setError('');

    if (!payload.full_name) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    if (!payload.email) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    if (!isValidEmail(payload.email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    if (form.password && form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.password) {
      payload.password = form.password;
    }

    setSaving(true);

    try {
      const res = await updateMe(token, payload);
      updateCurrentUser(res.data);
      setForm({
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        password: '',
      });
      setMessage('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
    } catch (err) {
      setError(PROFILE_ERROR_MESSAGES[err.message] || err.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button type="button" className="profile-brand" onClick={() => onNavigate('/')}>
          ห้วยหยวกปากโจ้
        </button>
        <div className="profile-header-actions">
          <button type="button" onClick={() => onNavigate('/')}>
            กลับหน้าแรก
          </button>
          <button type="button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="profile-main">
        <section className="profile-summary">
          <div className="profile-avatar-xl" aria-hidden="true">
            {profileInitial}
          </div>
          <div>
            <p>Profile</p>
            <h1>แก้ไขโปรไฟล์</h1>
            <span>จัดการข้อมูลบัญชี ชื่อ อีเมล เบอร์โทร ที่อยู่ และรหัสผ่านของคุณ</span>
          </div>
        </section>

        <section className="profile-card">
          <form className="profile-form" onSubmit={handleSubmit}>
            {error ? <div className="profile-alert error">{error}</div> : null}
            {message ? <div className="profile-alert success">{message}</div> : null}

            <label>
              ชื่อ-นามสกุล
              <input
                value={form.full_name}
                onChange={(event) => handleChange('full_name', event.target.value)}
                required
              />
            </label>

            <label>
              อีเมล
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                required
              />
            </label>

            <label>
              เบอร์โทร
              <input
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
              />
            </label>

            <label>
              รหัสผ่านใหม่
              <input
                type="password"
                value={form.password}
                placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน"
                onChange={(event) => handleChange('password', event.target.value)}
              />
            </label>

            <label className="profile-form-wide">
              ที่อยู่
              <textarea
                rows="4"
                value={form.address}
                onChange={(event) => handleChange('address', event.target.value)}
              />
            </label>

            <div className="profile-form-actions">
              <button type="button" className="profile-secondary-button" onClick={() => onNavigate('/')}>
                ยกเลิก
              </button>
              <button type="submit" className="profile-primary-button" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
