import { useState } from 'react';
import { updateMe } from '../api/auth';
import { fetchThaiAddressData } from '../api/thaiAddress';
import { useEffect, useMemo } from 'react';
import CustomerNavbar from '../components/CustomerNavbar';
import { useAuth } from '../context/AuthContext';
import {
  clearGoogleAddressCompletion,
  hasPendingGoogleAddressCompletion,
} from '../utils/googleProfileReminder';
import { formatAddressForDisplay, formatProfileAddress, parseProfileAddress } from '../utils/profileAddress';
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
  const [addressFields, setAddressFields] = useState(() => parseProfileAddress(user?.address));
  const [thaiAddressData, setThaiAddressData] = useState({
    provinces: [],
    districts: [],
    subdistricts: [],
  });
  const [addressDataLoading, setAddressDataLoading] = useState(true);
  const [addressDataError, setAddressDataError] = useState('');
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedSubdistrictId, setSelectedSubdistrictId] = useState('');
  const [editingProfile, setEditingProfile] = useState(completingGoogleAddress);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const profileInitial = form.full_name.trim().charAt(0).toUpperCase() || 'U';

  useEffect(() => {
    let isActive = true;
    const storedAddress = parseProfileAddress(user?.address);

    fetchThaiAddressData()
      .then((data) => {
        if (!isActive) return;

        const province = data.provinces.find(
          (item) => item.name_th === storedAddress.province,
        );
        const district = data.districts.find(
          (item) =>
            item.name_th === storedAddress.district &&
            (!province || item.province_id === province.id),
        );
        const subdistrict = data.subdistricts.find(
          (item) =>
            item.name_th === storedAddress.subdistrict &&
            (!district || item.district_id === district.id),
        );

        setThaiAddressData(data);
        setSelectedProvinceId(province ? String(province.id) : '');
        setSelectedDistrictId(district ? String(district.id) : '');
        setSelectedSubdistrictId(subdistrict ? String(subdistrict.id) : '');
      })
      .catch(() => {
        if (isActive) {
          setAddressDataError('ไม่สามารถโหลดข้อมูลพื้นที่ได้ กรุณาลองใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (isActive) setAddressDataLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user?.address]);

  const districtById = useMemo(
    () => new Map(thaiAddressData.districts.map((district) => [district.id, district])),
    [thaiAddressData.districts],
  );

  const postalCodeMatches = useMemo(() => {
    if (addressFields.postalCode.length !== 5) return [];

    return thaiAddressData.subdistricts.filter(
      (subdistrict) =>
        String(subdistrict.zip_code).padStart(5, '0') === addressFields.postalCode,
    );
  }, [addressFields.postalCode, thaiAddressData.subdistricts]);

  const postalDistrictIds = useMemo(
    () => new Set(postalCodeMatches.map((subdistrict) => subdistrict.district_id)),
    [postalCodeMatches],
  );

  const postalProvinceIds = useMemo(
    () =>
      new Set(
        [...postalDistrictIds]
          .map((districtId) => districtById.get(districtId)?.province_id)
          .filter(Boolean),
      ),
    [districtById, postalDistrictIds],
  );

  const provinceOptions = useMemo(() => {
    if (addressFields.postalCode.length === 5 && postalCodeMatches.length > 0) {
      return thaiAddressData.provinces.filter((province) => postalProvinceIds.has(province.id));
    }

    return thaiAddressData.provinces;
  }, [
    addressFields.postalCode,
    postalCodeMatches.length,
    postalProvinceIds,
    thaiAddressData.provinces,
  ]);

  const districtOptions = useMemo(() => {
    if (!selectedProvinceId) return [];

    return thaiAddressData.districts.filter((district) => {
      const belongsToProvince = String(district.province_id) === selectedProvinceId;
      const belongsToPostalCode =
        addressFields.postalCode.length !== 5 ||
        postalCodeMatches.length === 0 ||
        postalDistrictIds.has(district.id);

      return belongsToProvince && belongsToPostalCode;
    });
  }, [
    addressFields.postalCode,
    postalCodeMatches.length,
    postalDistrictIds,
    selectedProvinceId,
    thaiAddressData.districts,
  ]);

  const subdistrictOptions = useMemo(() => {
    if (!selectedDistrictId) return [];

    return thaiAddressData.subdistricts.filter((subdistrict) => {
      const belongsToDistrict = String(subdistrict.district_id) === selectedDistrictId;
      const belongsToPostalCode =
        addressFields.postalCode.length !== 5 ||
        postalCodeMatches.length === 0 ||
        String(subdistrict.zip_code).padStart(5, '0') === addressFields.postalCode;

      return belongsToDistrict && belongsToPostalCode;
    });
  }, [
    addressFields.postalCode,
    postalCodeMatches.length,
    selectedDistrictId,
    thaiAddressData.subdistricts,
  ]);

  const handleChange = (field, value) => {
    if (field === 'phone') {
      const digits = String(value).replace(/\D/g, '').slice(0, 10);
      setForm((current) => ({ ...current, phone: digits }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setAddressFields((current) => ({ ...current, [field]: value }));
  };

  const handlePostalCodeChange = (value) => {
    const postalCode = value.replace(/\D/g, '').slice(0, 5);
    const matches =
      postalCode.length === 5
        ? thaiAddressData.subdistricts.filter(
            (subdistrict) =>
              String(subdistrict.zip_code).padStart(5, '0') === postalCode,
          )
        : [];
    const matchedDistrictIds = new Set(matches.map((subdistrict) => subdistrict.district_id));
    const matchedDistricts = [...matchedDistrictIds]
      .map((districtId) => districtById.get(districtId))
      .filter(Boolean);
    const matchedProvinceIds = new Set(matchedDistricts.map((district) => district.province_id));
    const province =
      matchedProvinceIds.size === 1
        ? thaiAddressData.provinces.find(
            (item) => item.id === matchedProvinceIds.values().next().value,
          )
        : undefined;
    const district = matchedDistricts.length === 1 ? matchedDistricts[0] : undefined;
    const subdistrict = matches.length === 1 ? matches[0] : undefined;

    setSelectedProvinceId(province ? String(province.id) : '');
    setSelectedDistrictId(district ? String(district.id) : '');
    setSelectedSubdistrictId(subdistrict ? String(subdistrict.id) : '');
    setAddressFields((current) => ({
      ...current,
      postalCode,
      province: province?.name_th || '',
      district: district?.name_th || '',
      subdistrict: subdistrict?.name_th || '',
    }));
  };

  const selectProvince = (provinceId) => {
    const province = thaiAddressData.provinces.find(
      (item) => String(item.id) === provinceId,
    );
    const currentPostalCode = addressFields.postalCode;
    const postalCodeIsCompatible =
      currentPostalCode.length === 5 &&
      postalCodeMatches.some(
        (subdistrict) =>
          String(districtById.get(subdistrict.district_id)?.province_id) === provinceId,
      );

    setSelectedProvinceId(provinceId);
    setSelectedDistrictId('');
    setSelectedSubdistrictId('');
    setAddressFields((current) => ({
      ...current,
      province: province?.name_th || '',
      district: '',
      subdistrict: '',
      postalCode: postalCodeIsCompatible ? currentPostalCode : '',
    }));
  };

  const selectDistrict = (districtId) => {
    const district = districtById.get(Number(districtId));
    const currentPostalCode = addressFields.postalCode;
    const postalCodeIsCompatible =
      currentPostalCode.length === 5 &&
      postalCodeMatches.some(
        (subdistrict) => String(subdistrict.district_id) === districtId,
      );

    setSelectedDistrictId(districtId);
    setSelectedSubdistrictId('');
    setAddressFields((current) => ({
      ...current,
      district: district?.name_th || '',
      subdistrict: '',
      postalCode: postalCodeIsCompatible ? currentPostalCode : '',
    }));
  };

  const selectSubdistrict = (subdistrictId) => {
    const subdistrict = thaiAddressData.subdistricts.find(
      (item) => String(item.id) === subdistrictId,
    );

    setSelectedSubdistrictId(subdistrictId);
    setAddressFields((current) => ({
      ...current,
      subdistrict: subdistrict?.name_th || '',
      postalCode: subdistrict ? String(subdistrict.zip_code).padStart(5, '0') : '',
    }));
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
      clearGoogleAddressCompletion();
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

              <fieldset className="account-address-fields">
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
                <p><span>ที่อยู่:</span> {formatAddressForDisplay(formatProfileAddress(addressFields))}</p>
              ) : null}
            </div>
          )}
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
