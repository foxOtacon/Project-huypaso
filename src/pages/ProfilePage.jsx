import { useState } from 'react';
import { updateMe } from '../api/auth';
import { createAddress, deleteAddress, fetchAddresses, setDefaultAddress, updateAddress } from '../api/addresses';
import { fetchThaiAddressData } from '../api/thaiAddress';
import { useEffect, useMemo } from 'react';
import CustomerNavbar from '../components/CustomerNavbar';
import { useAuth } from '../context/AuthContext';
import {
  clearGoogleAddressCompletion,
  hasPendingGoogleAddressCompletion,
} from '../utils/googleProfileReminder';
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
  const needsAddress = !String(user?.address || '').trim();
  const completingGoogleAddress = needsAddress && hasPendingGoogleAddressCompletion(user);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
  });
  const [thaiAddressData, setThaiAddressData] = useState({
    provinces: [],
    districts: [],
    subdistricts: [],
  });
  const [addressDataLoading, setAddressDataLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(completingGoogleAddress);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [addressManagerOpen, setAddressManagerOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressForm, setAddressForm] = useState({ label: '', recipient_name: '', phone: '' });
  const [savedAddressFields, setSavedAddressFields] = useState(() => parseProfileAddress(''));
  const [savedProvinceId, setSavedProvinceId] = useState('');
  const [savedDistrictId, setSavedDistrictId] = useState('');
  const [savedSubdistrictId, setSavedSubdistrictId] = useState('');
  const profileInitial = form.full_name.trim().charAt(0).toUpperCase() || 'U';

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetchAddresses(token).then((items) => {
      if (active) setAddresses(items);
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  function updateAddressForm(field, value) {
    const nextValue = field === 'phone' ? String(value).replace(/\D/g, '').slice(0, 10) : value;
    setAddressForm((current) => ({ ...current, [field]: nextValue }));
  }

  const savedDistrictOptions = useMemo(() => {
    if (!savedProvinceId) return [];
    return thaiAddressData.districts.filter((item) => String(item.province_id) === savedProvinceId);
  }, [savedProvinceId, thaiAddressData.districts]);

  const savedSubdistrictOptions = useMemo(() => {
    if (!savedDistrictId) return [];
    return thaiAddressData.subdistricts.filter((item) => String(item.district_id) === savedDistrictId);
  }, [savedDistrictId, thaiAddressData.subdistricts]);

  function updateSavedAddressField(field, value) {
    setSavedAddressFields((current) => ({ ...current, [field]: value }));
  }

  function handleSavedPostalCodeChange(value) {
    const postalCode = value.replace(/\D/g, '').slice(0, 5);
    const matches = postalCode.length === 5
      ? thaiAddressData.subdistricts.filter((item) => String(item.zip_code).padStart(5, '0') === postalCode)
      : [];
    const district = matches.length === 1 ? districtById.get(matches[0].district_id) : null;
    const province = district
      ? thaiAddressData.provinces.find((item) => item.id === district.province_id)
      : null;
    const subdistrict = matches.length === 1 ? matches[0] : null;
    setSavedProvinceId(province ? String(province.id) : '');
    setSavedDistrictId(district ? String(district.id) : '');
    setSavedSubdistrictId(subdistrict ? String(subdistrict.id) : '');
    setSavedAddressFields((current) => ({
      ...current,
      postalCode,
      province: province?.name_th || '',
      district: district?.name_th || '',
      subdistrict: subdistrict?.name_th || '',
    }));
  }

  function selectSavedProvince(value) {
    const province = thaiAddressData.provinces.find((item) => String(item.id) === value);
    setSavedProvinceId(value);
    setSavedDistrictId('');
    setSavedSubdistrictId('');
    setSavedAddressFields((current) => ({ ...current, province: province?.name_th || '', district: '', subdistrict: '' }));
  }

  function selectSavedDistrict(value) {
    const district = thaiAddressData.districts.find((item) => String(item.id) === value);
    setSavedDistrictId(value);
    setSavedSubdistrictId('');
    setSavedAddressFields((current) => ({ ...current, district: district?.name_th || '', subdistrict: '' }));
  }

  function selectSavedSubdistrict(value) {
    const subdistrict = thaiAddressData.subdistricts.find((item) => String(item.id) === value);
    setSavedSubdistrictId(value);
    setSavedAddressFields((current) => ({
      ...current,
      subdistrict: subdistrict?.name_th || '',
      postalCode: subdistrict ? String(subdistrict.zip_code).padStart(5, '0') : current.postalCode,
    }));
  }

  function resetAddressForm() {
    setAddressForm({ label: '', recipient_name: '', phone: '' });
    setSavedAddressFields(parseProfileAddress(''));
    setSavedProvinceId('');
    setSavedDistrictId('');
    setSavedSubdistrictId('');
  }

  function openAddressEditor(address) {
    const parsedAddress = parseProfileAddress(address.address || '');
    const province = thaiAddressData.provinces.find((item) => item.name_th === parsedAddress.province);
    const district = thaiAddressData.districts.find((item) => item.name_th === parsedAddress.district && (!province || item.province_id === province.id));
    const subdistrict = thaiAddressData.subdistricts.find((item) => item.name_th === parsedAddress.subdistrict && (!district || item.district_id === district.id));
    setEditingAddressId(address.address_id);
    setAddressForm({ label: address.label || '', recipient_name: address.recipient_name || '', phone: address.phone || '' });
    setSavedAddressFields(parsedAddress);
    setSavedProvinceId(province ? String(province.id) : '');
    setSavedDistrictId(district ? String(district.id) : '');
    setSavedSubdistrictId(subdistrict ? String(subdistrict.id) : '');
    setAddressManagerOpen(true);
  }

  async function handleAddAddress(event) {
    event.preventDefault();
    setAddressSaving(true);
    setError('');
    try {
      const formattedAddress = formatProfileAddress(savedAddressFields);
      if (!formattedAddress || !savedAddressFields.postalCode.trim()) {
        setError('กรุณากรอกข้อมูลที่อยู่และรหัสไปรษณีย์ให้ครบถ้วน');
        return;
      }
      const payload = { ...addressForm, address: formattedAddress };
      if (editingAddressId) {
        const updated = await updateAddress(token, editingAddressId, payload);
        setAddresses((current) => current.map((item) => item.address_id === updated.address_id ? updated : item));
      } else {
        const created = await createAddress(token, { ...payload, is_default: addresses.length === 0 });
        setAddresses((current) => [created, ...current.map((item) => ({ ...item, is_default: created.is_default ? false : item.is_default }))]);
      }
      resetAddressForm();
      setEditingAddressId(null);
      setAddressManagerOpen(false);
      setMessage(editingAddressId ? 'แก้ไขที่อยู่จัดส่งเรียบร้อยแล้ว' : 'เพิ่มที่อยู่จัดส่งเรียบร้อยแล้ว');
    } catch (err) {
      setError(err.message || 'ไม่สามารถเพิ่มที่อยู่ได้');
    } finally {
      setAddressSaving(false);
    }
  }

  async function handleSetDefaultAddress(addressId) {
    try {
      await setDefaultAddress(token, addressId);
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.address_id === addressId })));
      setMessage('เปลี่ยนที่อยู่เริ่มต้นแล้ว');
    } catch (err) {
      setError(err.message || 'ไม่สามารถเปลี่ยนที่อยู่เริ่มต้นได้');
    }
  }

  async function handleDeleteAddress(addressId) {
    try {
      await deleteAddress(token, addressId);
      setAddresses((current) => current.filter((item) => item.address_id !== addressId));
      setMessage('ลบที่อยู่เรียบร้อยแล้ว');
    } catch (err) {
      setError(err.message || 'ไม่สามารถลบที่อยู่ได้');
    }
  }

  useEffect(() => {
    let isActive = true;

    fetchThaiAddressData()
      .then((data) => {
        if (!isActive) return;

        setThaiAddressData(data);
      })
      .catch(() => null)
      .finally(() => {
        if (isActive) setAddressDataLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  // The address option maps are intentionally memoized because the source data is large.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const districtById = useMemo(
    () => new Map(thaiAddressData.districts.map((district) => [district.id, district])),
    [thaiAddressData.districts],
  );

  const handleChange = (field, value) => {
    if (field === 'phone') {
      const digits = String(value).replace(/\D/g, '').slice(0, 10);
      setForm((current) => ({ ...current, phone: digits }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
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
      clearGoogleAddressCompletion();
      updateCurrentUser(res.data);
      setForm((current) => ({
        ...current,
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
      }));
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
        <section className="account-hero">
          <div className="account-hero-avatar" aria-hidden="true">{profileInitial}</div>
          <div className="account-hero-copy">
            <p>บัญชีสมาชิกชุมชน</p>
            <h1>บัญชีของฉัน</h1>
            <span>จัดการข้อมูลส่วนตัว ที่อยู่จัดส่ง และความปลอดภัยของบัญชี</span>
          </div>
          <div className="account-hero-status">
            <span>สถานะบัญชี</span>
            <strong><i /> พร้อมใช้งาน</strong>
          </div>
        </section>

        {error ? <div className="account-alert error">{error}</div> : null}
        {message ? <div className="account-alert success">{message}</div> : null}
        {completingGoogleAddress ? (
          <div className="account-alert notice">
            เข้าสู่ระบบด้วย Google สำเร็จ กรุณากรอกเบอร์โทรศัพท์และที่อยู่สำหรับจัดส่งสินค้าให้ครบถ้วน
          </div>
        ) : null}

        <section className="account-card account-profile-card">
          <div className="account-card-header">
            <div>
              <p>ข้อมูลสำหรับการติดต่อและจัดส่ง</p>
              <h2>ข้อมูลส่วนตัว</h2>
            </div>
            <button type="button" className="account-edit-button" aria-expanded={editingProfile} onClick={() => setEditingProfile((open) => !open)}>
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

              {/* <fieldset className="account-address-fields">
                <legend>ที่อยู่สำหรับจัดส่ง</legend>
                {addressDataError ? (
                  <div className="account-address-data-message error">{addressDataError}</div>
                ) : null}
                <div className="account-address-grid">
                  <label className="address-half">
                    <span className="account-field-label">รหัสไปรษณีย์<span className="account-required">*</span></span>
                    <input
                      value={addressFields.postalCode}
                      onChange={(event) => handlePostalCodeChange(event.target.value)}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength="5"
                      autoFocus={completingGoogleAddress}
                      disabled={saving || addressDataLoading}
                      required
                    />
                    {addressDataLoading ? <small>กำลังโหลดข้อมูลพื้นที่...</small> : null}
                    {!addressDataLoading &&
                    !addressDataError &&
                    addressFields.postalCode.length === 5 &&
                    postalCodeMatches.length === 0 ? (
                      <small className="account-field-error">ไม่พบรหัสไปรษณีย์นี้</small>
                    ) : null}
                    {postalCodeMatches.length > 1 && !selectedSubdistrictId ? (
                      <small>พบหลายพื้นที่ กรุณาเลือกจังหวัด อำเภอ และตำบล</small>
                    ) : null}
                  </label>
                  <label className="address-half">
                    จังหวัด
                    <select
                      value={selectedProvinceId}
                      onChange={(event) => selectProvince(event.target.value)}
                      autoComplete="address-level1"
                      disabled={saving || addressDataLoading || Boolean(addressDataError)}
                    >
                      <option value="">เลือกจังหวัด</option>
                      {provinceOptions.map((province) => (
                        <option key={province.id} value={province.id}>{province.name_th}</option>
                      ))}
                    </select>
                  </label>
                  <label className="address-half">
                    อำเภอ / เขต
                    <select
                      value={selectedDistrictId}
                      onChange={(event) => selectDistrict(event.target.value)}
                      autoComplete="address-level2"
                      disabled={
                        saving ||
                        addressDataLoading ||
                        Boolean(addressDataError) ||
                        !selectedProvinceId
                      }
                    >
                      <option value="">เลือกอำเภอ / เขต</option>
                      {districtOptions.map((district) => (
                        <option key={district.id} value={district.id}>{district.name_th}</option>
                      ))}
                    </select>
                  </label>
                  <label className="address-half">
                    ตำบล / แขวง
                    <select
                      value={selectedSubdistrictId}
                      onChange={(event) => selectSubdistrict(event.target.value)}
                      autoComplete="address-level3"
                      disabled={
                        saving ||
                        addressDataLoading ||
                        Boolean(addressDataError) ||
                        !selectedDistrictId
                      }
                    >
                      <option value="">เลือกตำบล / แขวง</option>
                      {subdistrictOptions.map((subdistrict) => (
                        <option key={subdistrict.id} value={subdistrict.id}>{subdistrict.name_th}</option>
                      ))}
                    </select>
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
              </fieldset> */}
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
            </div>
          )}
        </section>

        <section className="account-card account-address-book-card">
          <div className="account-card-header">
            <div>
              <p>จัดเก็บที่อยู่สำหรับการสั่งซื้อ</p>
              <h2>ที่อยู่ของฉัน</h2>
            </div>
            <button type="button" className="account-edit-button" onClick={() => setAddressManagerOpen((open) => !open)}>
              + เพิ่มที่อยู่
            </button>
          </div>
          {addresses.length ? (
            <div className="saved-address-list">
              {addresses.map((item) => (
                <article className="saved-address-item" key={item.address_id}>
                  <div className="saved-address-info">
                    <strong>{item.label}</strong>{item.is_default ? <span className="saved-address-default">ค่าเริ่มต้น</span> : null}
                    <p className="saved-address-recipient">{item.recipient_name} <span aria-hidden="true">·</span> {item.phone}</p>
                    <p className="saved-address-location">{String(item.address || '').replace(/\s*\|\s*/g, ' ')}</p>
                  </div>
                  <div className="saved-address-actions" aria-label={`จัดการที่อยู่ ${item.label}`}>
                    {!item.is_default ? <button type="button" onClick={() => handleSetDefaultAddress(item.address_id)}>ตั้งเป็นค่าเริ่มต้น</button> : null}
                    <button type="button" onClick={() => openAddressEditor(item)}>แก้ไข</button>
                    <button type="button" onClick={() => handleDeleteAddress(item.address_id)}>ลบ</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="account-address-empty">ยังไม่มีที่อยู่เพิ่มเติม</p>}
          {addressManagerOpen ? (
            <form className="saved-address-form account-form" onSubmit={handleAddAddress}>
              <div className="saved-address-form-heading">
                <label><span>ชื่อที่อยู่</span><input value={addressForm.label} onChange={(event) => updateAddressForm('label', event.target.value)} placeholder="เช่น บ้าน / ที่ทำงาน" required /></label>
                <label><span>ชื่อผู้รับ</span><input value={addressForm.recipient_name} onChange={(event) => updateAddressForm('recipient_name', event.target.value)} placeholder="ชื่อ-นามสกุล" required /></label>
                <label><span>เบอร์โทรศัพท์</span><input value={addressForm.phone} onChange={(event) => updateAddressForm('phone', event.target.value)} placeholder="เบอร์โทร" required /></label>
              </div>
              <fieldset className="account-address-fields saved-address-fields">
                <legend>ที่อยู่สำหรับจัดส่ง</legend>
                <div className="account-address-grid">
                  <label className="address-half"><span className="account-field-label">รหัสไปรษณีย์<span className="account-required">*</span></span><input value={savedAddressFields.postalCode} onChange={(event) => handleSavedPostalCodeChange(event.target.value)} inputMode="numeric" maxLength="5" required /></label>
                  <label className="address-half"><span>จังหวัด</span><select value={savedProvinceId} onChange={(event) => selectSavedProvince(event.target.value)} disabled={addressDataLoading}><option value="">เลือกจังหวัด</option>{thaiAddressData.provinces.map((item) => <option key={item.id} value={item.id}>{item.name_th}</option>)}</select></label>
                  <label className="address-half"><span>อำเภอ / เขต</span><select value={savedDistrictId} onChange={(event) => selectSavedDistrict(event.target.value)} disabled={!savedProvinceId || addressDataLoading}><option value="">เลือกอำเภอ / เขต</option>{savedDistrictOptions.map((item) => <option key={item.id} value={item.id}>{item.name_th}</option>)}</select></label>
                  <label className="address-half"><span>ตำบล / แขวง</span><select value={savedSubdistrictId} onChange={(event) => selectSavedSubdistrict(event.target.value)} disabled={!savedDistrictId || addressDataLoading}><option value="">เลือกตำบล / แขวง</option>{savedSubdistrictOptions.map((item) => <option key={item.id} value={item.id}>{item.name_th}</option>)}</select></label>
                  <label className="address-four"><span>บ้านเลขที่</span><input value={savedAddressFields.roomNumber} onChange={(event) => updateSavedAddressField('roomNumber', event.target.value)} /></label>
                  <label className="address-two"><span>ชั้นที่</span><input value={savedAddressFields.floor} onChange={(event) => updateSavedAddressField('floor', event.target.value)} /></label>
                  <label className="address-half"><span>ชื่ออาคาร</span><input value={savedAddressFields.buildingName} onChange={(event) => updateSavedAddressField('buildingName', event.target.value)} /></label>
                  <label className="address-four"><span>เลขที่</span><input value={savedAddressFields.houseNumber} onChange={(event) => updateSavedAddressField('houseNumber', event.target.value)} /></label>
                  <label className="address-two"><span>หมู่</span><input value={savedAddressFields.moo} onChange={(event) => updateSavedAddressField('moo', event.target.value)} /></label>
                  <label className="address-half"><span>หมู่บ้าน</span><input value={savedAddressFields.village} onChange={(event) => updateSavedAddressField('village', event.target.value)} /></label>
                  <label className="address-half"><span>ซอย</span><input value={savedAddressFields.soi} onChange={(event) => updateSavedAddressField('soi', event.target.value)} /></label>
                  <label className="address-half"><span>ถนน</span><input value={savedAddressFields.road} onChange={(event) => updateSavedAddressField('road', event.target.value)} /></label>
                  <label className="address-full"><span>รายละเอียดเพิ่มเติม</span><small>* กรุณาระบุข้อมูลเท่าที่จำเป็น กรณีไม่มีข้อมูลให้เว้นว่างไว้</small><textarea rows="4" value={savedAddressFields.additionalDetails} onChange={(event) => updateSavedAddressField('additionalDetails', event.target.value)} /></label>
                </div>
              </fieldset>
              <div className="profile-account-actions">
                <button type="button" onClick={() => { resetAddressForm(); setEditingAddressId(null); setAddressManagerOpen(false); }} disabled={addressSaving}>ยกเลิก</button>
                <button type="submit" className="account-primary-button" disabled={addressSaving}>{addressSaving ? 'กำลังบันทึก...' : editingAddressId ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="account-card account-security-card">
          <div className="account-card-header">
            <div>
              <p>รักษาบัญชีของคุณให้ปลอดภัย</p>
              <h2>รหัสผ่านและความปลอดภัย</h2>
            </div>
            <button type="button" className="account-edit-button" aria-expanded={editingPassword} onClick={() => setEditingPassword((open) => !open)}>
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
