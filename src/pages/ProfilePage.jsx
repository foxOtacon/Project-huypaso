import { useState } from 'react';
import { updateMe } from '../api/auth';
import CustomerNavbar from '../components/CustomerNavbar';
import { useAuth } from '../context/AuthContext';
import { formatProfileAddress, parseProfileAddress } from '../utils/profileAddress';
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

function maskName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '-';
  const [firstName, ...rest] = trimmed.split(/\s+/);
  const lastName = rest.join(' ');
  return lastName ? `${firstName} ${'*'.repeat(Math.min(lastName.length, 8))}` : firstName;
}

export default function ProfilePage({ user, onNavigate, onLogout }) {
  const { token, updateCurrentUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
  });
  const [addressFields, setAddressFields] = useState(() => parseProfileAddress(user?.address));
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setAddressFields((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: formatProfileAddress(addressFields),
    };

    setMessage('');
    setError('');

    if (!payload.full_name) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    if (!payload.phone) {
      setError('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    if (!addressFields.postalCode.trim()) {
      setError('กรุณากรอกรหัสไปรษณีย์');
      return;
    }

    if (!/^\d{5}$/.test(addressFields.postalCode.trim())) {
      setError('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
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

    setSaving(true);

    try {
      const res = await updateMe(token, payload);
      updateCurrentUser(res.data);
      setForm((current) => ({
        ...current,
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
      }));
      setAddressFields(parseProfileAddress(res.data.address));
      setEditingProfile(false);
      setMessage('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    } catch (err) {
      setError(PROFILE_ERROR_MESSAGES[err.message] || err.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!form.password || form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setSaving(true);

    try {
      const res = await updateMe(token, { password: form.password });
      updateCurrentUser(res.data);
      setForm((current) => ({ ...current, password: '' }));
      setEditingPassword(false);
      setMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch (err) {
      setError(PROFILE_ERROR_MESSAGES[err.message] || err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="account-main">
        {error ? <div className="account-alert error">{error}</div> : null}
        {message ? <div className="account-alert success">{message}</div> : null}

        <section className="account-card">
          <div className="account-card-header">
            <h2>ตั้งค่าข้อมูลส่วนตัว</h2>
            <button type="button" className="account-edit-button" onClick={() => setEditingProfile((open) => !open)}>
              ✎ แก้ไข
            </button>
          </div>

          {editingProfile ? (
            <form className="account-form" onSubmit={saveProfile}>
              <label>
                <span className="account-field-label">ชื่อ - นามสกุล<span className="account-required">*</span></span>
                <input
                  value={form.full_name}
                  onChange={(event) => handleChange('full_name', event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span className="account-field-label">เบอร์โทรศัพท์<span className="account-required">*</span></span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  autoComplete="tel"
                  required
                />
              </label>
              <label className="account-form-wide">
                <span className="account-field-label">อีเมล<span className="account-required">*</span></span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <fieldset className="account-address-fields">
                <legend>ที่อยู่สำหรับจัดส่ง</legend>
                <div className="account-address-grid">
                  <label className="address-half">
                    <span className="account-field-label">รหัสไปรษณีย์<span className="account-required">*</span></span>
                    <input
                      value={addressFields.postalCode}
                      onChange={(event) => handleAddressChange('postalCode', event.target.value.replace(/\D/g, '').slice(0, 5))}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength="5"
                      required
                    />
                  </label>
                  <label className="address-half">
                    จังหวัด
                    <input value={addressFields.province} onChange={(event) => handleAddressChange('province', event.target.value)} autoComplete="address-level1" />
                  </label>
                  <label className="address-half">
                    อำเภอ / เขต
                    <input value={addressFields.district} onChange={(event) => handleAddressChange('district', event.target.value)} autoComplete="address-level2" />
                  </label>
                  <label className="address-half">
                    ตำบล / แขวง
                    <input value={addressFields.subdistrict} onChange={(event) => handleAddressChange('subdistrict', event.target.value)} autoComplete="address-level3" />
                  </label>
                  <label className="address-four">
                    บ้านเลขที่
                    <input value={addressFields.roomNumber} onChange={(event) => handleAddressChange('roomNumber', event.target.value)} />
                  </label>
                  <label className="address-two">
                    ชั้นที่
                    <input value={addressFields.floor} onChange={(event) => handleAddressChange('floor', event.target.value)} />
                  </label>
                  <label className="address-half">
                    ชื่ออาคาร
                    <input value={addressFields.buildingName} onChange={(event) => handleAddressChange('buildingName', event.target.value)} />
                  </label>
                  <label className="address-four">
                    เลขที่
                    <input value={addressFields.houseNumber} onChange={(event) => handleAddressChange('houseNumber', event.target.value)} />
                  </label>
                  <label className="address-two">
                    หมู่
                    <input value={addressFields.moo} onChange={(event) => handleAddressChange('moo', event.target.value)} />
                  </label>
                  <label className="address-half">
                    หมู่บ้าน
                    <input value={addressFields.village} onChange={(event) => handleAddressChange('village', event.target.value)} />
                  </label>
                  <label className="address-half">
                    ซอย
                    <input value={addressFields.soi} onChange={(event) => handleAddressChange('soi', event.target.value)} />
                  </label>
                  <label className="address-half">
                    ถนน
                    <input value={addressFields.road} onChange={(event) => handleAddressChange('road', event.target.value)} />
                  </label>
                  <label className="address-full">
                    รายละเอียดเพิ่มเติม
                    <small>* กรุณาระบุข้อมูลเท่าที่จำเป็น กรณีไม่มีข้อมูลให้เว้นว่างไว้ ไม่ต้องใส่เครื่องหมาย “-”</small>
                    <textarea
                      rows="4"
                      value={addressFields.additionalDetails}
                      onChange={(event) => handleAddressChange('additionalDetails', event.target.value)}
                      autoComplete="street-address"
                    />
                  </label>
                </div>
              </fieldset>
              <div className="profile-account-actions">
                <button type="button" onClick={() => setEditingProfile(false)} disabled={saving}>ยกเลิก</button>
                <button type="submit" className="account-primary-button" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          ) : (
            <div className="account-details">
              <p><span>ชื่อ - นามสกุล:</span> <strong>{maskName(form.full_name)}</strong></p>
              <p><span>อีเมล:</span> {form.email || '-'}</p>
              <p><span>เบอร์โทรศัพท์:</span> {form.phone || '-'}</p>
              {formatProfileAddress(addressFields) ? (
                <p><span>ที่อยู่:</span> {formatProfileAddress(addressFields)}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="account-card">
          <div className="account-card-header">
            <h2>เปลี่ยนรหัสผ่าน</h2>
            <button type="button" className="account-edit-button" onClick={() => setEditingPassword((open) => !open)}>
              ✎ แก้ไข
            </button>
          </div>

          {editingPassword ? (
            <form className="account-form compact" onSubmit={savePassword}>
              <label>
                รหัสผ่านใหม่:
                <input
                  type="password"
                  value={form.password}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  onChange={(event) => handleChange('password', event.target.value)}
                />
              </label>
              <div className="profile-account-actions">
                <button type="button" onClick={() => setEditingPassword(false)} disabled={saving}>ยกเลิก</button>
                <button type="submit" className="account-primary-button" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          ) : (
            <div className="account-details">
              <p><span>รหัสผ่าน:</span> <strong>********</strong></p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
