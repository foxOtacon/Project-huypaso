const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'ไม่สามารถโหลดเนื้อหาเว็บไซต์ได้');
  }

  return data;
}

export async function fetchHistoryContent() {
  const response = await request('/site-content/history');
  return response.data || null;
}
