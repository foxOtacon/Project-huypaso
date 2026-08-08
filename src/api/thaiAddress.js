const THAI_ADDRESS_BASE_URL =
  'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest';

let thaiAddressDataPromise;

async function fetchJson(fileName) {
  const response = await fetch(`${THAI_ADDRESS_BASE_URL}/${fileName}`);

  if (!response.ok) {
    throw new Error(`Unable to load ${fileName} (${response.status})`);
  }

  return response.json();
}

export function fetchThaiAddressData() {
  if (!thaiAddressDataPromise) {
    thaiAddressDataPromise = Promise.all([
      fetchJson('province.json'),
      fetchJson('district.json'),
      fetchJson('sub_district.json'),
    ])
      .then(([provinces, districts, subdistricts]) => ({
        provinces,
        districts,
        subdistricts,
      }))
      .catch((error) => {
        thaiAddressDataPromise = undefined;
        throw error;
      });
  }

  return thaiAddressDataPromise;
}
