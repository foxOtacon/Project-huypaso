
const BACKEND_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
  }

  return data;
}

export async function fetchCatalogProducts() {
  const res = await request('/products');
  return res.data || [];
}

export async function fetchCatalogCategories() {
  const res = await request('/categories');
  return res.data || [];
}
