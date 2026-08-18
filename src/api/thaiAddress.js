const THAI_ADDRESS_BASE_URLS = [
  'https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master/api/latest',
  'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest',
];

let thaiAddressDataPromise;

async function fetchJson(fileName) {
  let lastError;

  for (const baseUrl of THAI_ADDRESS_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/${fileName}`);
      if (response.ok) return response.json();
      lastError = new Error(`Unable to load ${fileName} (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Unable to load ${fileName}`);
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
