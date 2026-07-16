
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
    throw new Error(data.message || 'ไม่สามารถโหลดข่าวได้');
  }

  return data;
}

export async function fetchPublishedNews() {
  const res = await request('/news');
  return res.data || [];
}

export async function fetchPublishedNewsById(newsId) {
  const res = await request(`/news/${newsId}`);
  return res.data;
}
