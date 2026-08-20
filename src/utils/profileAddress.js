export const EMPTY_PROFILE_ADDRESS = {
  postalCode: '',
  province: '',
  district: '',
  subdistrict: '',
  roomNumber: '',
  floor: '',
  buildingName: '',
  houseNumber: '',
  moo: '',
  village: '',
  soi: '',
  road: '',
  additionalDetails: '',
};

const ADDRESS_PARTS = [
  ['roomNumber', 'ห้องเลขที่'],
  ['floor', 'ชั้นที่'],
  ['buildingName', 'ชื่ออาคาร'],
  ['houseNumber', 'เลขที่'],
  ['village', 'หมู่บ้าน'],
  ['moo', 'หมู่'],
  ['soi', 'ซอย'],
  ['road', 'ถนน'],
  ['subdistrict', 'ตำบล/แขวง'],
  ['district', 'อำเภอ/เขต'],
  ['province', 'จังหวัด'],
  ['postalCode', 'รหัสไปรษณีย์'],
  ['additionalDetails', 'รายละเอียดเพิ่มเติม'],
];

export function parseProfileAddress(address) {
  const result = { ...EMPTY_PROFILE_ADDRESS };
  const text = String(address || '').trim();

  if (!text) return result;

  let recognizedParts = 0;
  const unrecognizedParts = [];

  text.split(/\s*\|\s*/).forEach((part) => {
    const trimmedPart = part.trim();
    const definition = ADDRESS_PARTS.find(([, label]) => trimmedPart.startsWith(`${label} `));

    if (!definition) {
      unrecognizedParts.push(trimmedPart);
      return;
    }

    const [key, label] = definition;
    result[key] = trimmedPart.slice(label.length).trim();
    recognizedParts += 1;
  });

  if (recognizedParts === 0) {
    result.additionalDetails = text;
  } else if (unrecognizedParts.length > 0) {
    result.additionalDetails = [result.additionalDetails, ...unrecognizedParts].filter(Boolean).join(' | ');
  }

  return result;
}

export function formatProfileAddress(addressFields) {
  return ADDRESS_PARTS.map(([key, label]) => {
    const value = String(addressFields?.[key] || '').trim();
    return value ? `${label} ${value}` : '';
  })
    .filter(Boolean)
    .join(' | ');
}

export function formatAddressForDisplay(address) {
  return String(address || '')
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const definition = ADDRESS_PARTS.find(([, label]) => part.startsWith(`${label} `));
      if (!definition) return part !== '-' && part !== 'ลบ';
      const [, label] = definition;
      const value = part.slice(label.length).trim();
      return value && value !== '-' && value !== 'ลบ';
    })
    .join(' ');
}
