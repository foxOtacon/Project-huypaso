import { useEffect, useMemo, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { register } from '../api/auth';
import { fetchThaiAddressData } from '../api/thaiAddress';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { EMPTY_PROFILE_ADDRESS, formatProfileAddress } from '../utils/profileAddress';

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
    address: { ...EMPTY_PROFILE_ADDRESS },
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  useEffect(() => {
    let isActive = true;

    fetchThaiAddressData()
      .then((data) => {
        if (isActive) setThaiAddressData(data);
      })
      .catch(() => {
        if (isActive) {
          setAddressDataError('ไม่สามารถโหลดข้อมูลพื้นที่ได้ กรุณาลองเปิดแบบฟอร์มใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (isActive) setAddressDataLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const districtById = useMemo(
    () => new Map(thaiAddressData.districts.map((district) => [district.id, district])),
    [thaiAddressData.districts],
  );

  const postalCodeMatches = useMemo(() => {
    if (form.address.postalCode.length !== 5) return [];

    return thaiAddressData.subdistricts.filter(
      (subdistrict) => String(subdistrict.zip_code).padStart(5, '0') === form.address.postalCode,
    );
  }, [form.address.postalCode, thaiAddressData.subdistricts]);

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
    if (form.address.postalCode.length === 5 && postalCodeMatches.length > 0) {
      return thaiAddressData.provinces.filter((province) => postalProvinceIds.has(province.id));
    }

    return thaiAddressData.provinces;
  }, [
    form.address.postalCode,
    postalCodeMatches.length,
    postalProvinceIds,
    thaiAddressData.provinces,
  ]);

  const districtOptions = useMemo(() => {
    if (!selectedProvinceId) return [];

    return thaiAddressData.districts.filter((district) => {
      const belongsToProvince = String(district.province_id) === selectedProvinceId;
      const belongsToPostalCode =
        form.address.postalCode.length !== 5 ||
        postalCodeMatches.length === 0 ||
        postalDistrictIds.has(district.id);

      return belongsToProvince && belongsToPostalCode;
    });
  }, [
    form.address.postalCode,
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
        form.address.postalCode.length !== 5 ||
        postalCodeMatches.length === 0 ||
        String(subdistrict.zip_code).padStart(5, '0') === form.address.postalCode;

      return belongsToDistrict && belongsToPostalCode;
    });
  }, [
    form.address.postalCode,
    postalCodeMatches.length,
    selectedDistrictId,
    thaiAddressData.subdistricts,
  ]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateAddressField(field, value) {
    setForm((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  }

  function updatePostalCode(value) {
    const postalCode = value.replace(/\D/g, '').slice(0, 5);
    const matches =
      postalCode.length === 5
        ? thaiAddressData.subdistricts.filter(
            (subdistrict) => String(subdistrict.zip_code).padStart(5, '0') === postalCode,
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
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        postalCode,
        province: province?.name_th || '',
        district: district?.name_th || '',
        subdistrict: subdistrict?.name_th || '',
      },
    }));
  }

  function selectProvince(provinceId) {
    const province = thaiAddressData.provinces.find(
      (item) => String(item.id) === provinceId,
    );
    const currentPostalCode = form.address.postalCode;
    const postalCodeIsCompatible =
      currentPostalCode.length === 5 &&
      postalCodeMatches.some(
        (subdistrict) =>
          String(districtById.get(subdistrict.district_id)?.province_id) === provinceId,
      );

    setSelectedProvinceId(provinceId);
    setSelectedDistrictId('');
    setSelectedSubdistrictId('');
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        province: province?.name_th || '',
        district: '',
        subdistrict: '',
        postalCode: postalCodeIsCompatible ? currentPostalCode : '',
      },
    }));
  }

  function selectDistrict(districtId) {
    const district = districtById.get(Number(districtId));
    const currentPostalCode = form.address.postalCode;
    const postalCodeIsCompatible =
      currentPostalCode.length === 5 &&
      postalCodeMatches.some(
        (subdistrict) => String(subdistrict.district_id) === districtId,
      );

    setSelectedDistrictId(districtId);
    setSelectedSubdistrictId('');
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        district: district?.name_th || '',
        subdistrict: '',
        postalCode: postalCodeIsCompatible ? currentPostalCode : '',
      },
    }));
  }

  function selectSubdistrict(subdistrictId) {
    const subdistrict = thaiAddressData.subdistricts.find(
      (item) => String(item.id) === subdistrictId,
    );

    setSelectedSubdistrictId(subdistrictId);
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        subdistrict: subdistrict?.name_th || '',
        postalCode: subdistrict ? String(subdistrict.zip_code).padStart(5, '0') : '',
      },
    }));
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
      const address = formatProfileAddress(form.address);

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
            onChange={(e) => {
              // allow only digits and limit to 10 characters
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              updateField('phone', digits);
            }}
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel"
            disabled={loading}
          />
        </Form.Group>

        <fieldset className="auth-address-fields">
          <legend>ที่อยู่</legend>
          {addressDataError && (
            <Alert variant="warning" className="mb-3">
              {addressDataError}
            </Alert>
          )}
          <div className="auth-address-grid">
            <Form.Group className="mb-3" controlId="registerPostalCode">
              <Form.Label>รหัสไปรษณีย์</Form.Label>
              <Form.Control
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="00000"
                value={form.address.postalCode}
                onChange={(e) => updatePostalCode(e.target.value)}
                autoComplete="postal-code"
                disabled={loading || addressDataLoading}
              />
              {addressDataLoading && <Form.Text>กำลังโหลดข้อมูลพื้นที่...</Form.Text>}
              {!addressDataLoading &&
                !addressDataError &&
                form.address.postalCode.length === 5 &&
                postalCodeMatches.length === 0 && (
                  <Form.Text className="text-danger">ไม่พบรหัสไปรษณีย์นี้</Form.Text>
                )}
              {postalCodeMatches.length > 1 && !selectedSubdistrictId && (
                <Form.Text>พบหลายพื้นที่ กรุณาเลือกจังหวัด อำเภอ และตำบล</Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerProvince">
              <Form.Label>จังหวัด</Form.Label>
              <Form.Control
                as="select"
                value={selectedProvinceId}
                onChange={(e) => selectProvince(e.target.value)}
                autoComplete="address-level1"
                disabled={loading || addressDataLoading || Boolean(addressDataError)}
              >
                <option value="">เลือกจังหวัด</option>
                {provinceOptions.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name_th}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerDistrict">
              <Form.Label>อำเภอ / เขต</Form.Label>
              <Form.Control
                as="select"
                value={selectedDistrictId}
                onChange={(e) => selectDistrict(e.target.value)}
                autoComplete="address-level2"
                disabled={
                  loading || addressDataLoading || Boolean(addressDataError) || !selectedProvinceId
                }
              >
                <option value="">เลือกอำเภอ / เขต</option>
                {districtOptions.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name_th}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerSubdistrict">
              <Form.Label>ตำบล / แขวง</Form.Label>
              <Form.Control
                as="select"
                value={selectedSubdistrictId}
                onChange={(e) => selectSubdistrict(e.target.value)}
                autoComplete="address-level3"
                disabled={
                  loading || addressDataLoading || Boolean(addressDataError) || !selectedDistrictId
                }
              >
                <option value="">เลือกตำบล / แขวง</option>
                {subdistrictOptions.map((subdistrict) => (
                  <option key={subdistrict.id} value={subdistrict.id}>
                    {subdistrict.name_th}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerHouseNumber">
              <Form.Label>บ้านเลขที่</Form.Label>
              <Form.Control
                type="text"
                placeholder="บ้านเลขที่"
                value={form.address.houseNumber}
                onChange={(e) => updateAddressField('houseNumber', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerFloor">
              <Form.Label>ชั้นที่</Form.Label>
              <Form.Control
                type="text"
                placeholder="ชั้นที่"
                value={form.address.floor}
                onChange={(e) => updateAddressField('floor', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerBuildingName">
              <Form.Label>ชื่ออาคาร</Form.Label>
              <Form.Control
                type="text"
                placeholder="ชื่ออาคาร"
                value={form.address.buildingName}
                onChange={(e) => updateAddressField('buildingName', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerRoomNumber">
              <Form.Label>เลขที่</Form.Label>
              <Form.Control
                type="text"
                placeholder="เลขที่ห้อง / ยูนิต"
                value={form.address.roomNumber}
                onChange={(e) => updateAddressField('roomNumber', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerMoo">
              <Form.Label>หมู่</Form.Label>
              <Form.Control
                type="text"
                placeholder="หมู่"
                value={form.address.moo}
                onChange={(e) => updateAddressField('moo', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerVillage">
              <Form.Label>หมู่บ้าน</Form.Label>
              <Form.Control
                type="text"
                placeholder="หมู่บ้าน"
                value={form.address.village}
                onChange={(e) => updateAddressField('village', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerSoi">
              <Form.Label>ซอย</Form.Label>
              <Form.Control
                type="text"
                placeholder="ซอย"
                value={form.address.soi}
                onChange={(e) => updateAddressField('soi', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="registerRoad">
              <Form.Label>ถนน</Form.Label>
              <Form.Control
                type="text"
                placeholder="ถนน"
                value={form.address.road}
                onChange={(e) => updateAddressField('road', e.target.value)}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-0 auth-field-wide" controlId="registerAdditionalDetails">
              <Form.Label>รายละเอียดเพิ่มเติม</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="เช่น จุดสังเกต หรือคำแนะนำสำหรับการจัดส่ง"
                value={form.address.additionalDetails}
                onChange={(e) => updateAddressField('additionalDetails', e.target.value)}
                disabled={loading}
              />
            </Form.Group>
          </div>
        </fieldset>

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
