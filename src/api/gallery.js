const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'ไม่สามารถจัดการ Gallery ได้');
  return data;
}

export async function fetchGalleryImages() {
  const response = await request('/site-gallery');
  return response.data || [];
}

export async function createGalleryImage(payload) {
  const response = await request('/site-gallery', { method: 'POST', body: JSON.stringify(payload) });
  return response.data;
}

export async function updateGalleryImage(galleryId, payload) {
  const response = await request(`/site-gallery/${galleryId}`, { method: 'PUT', body: JSON.stringify(payload) });
  return response.data;
}

export async function deleteGalleryImage(galleryId) {
  return request(`/site-gallery/${galleryId}`, { method: 'DELETE' });
}

export async function uploadGalleryImage({ fileName, dataUrl }) {
  const response = await request('/uploads/gallery-image', {
    method: 'POST',
    body: JSON.stringify({ fileName, dataUrl }),
  });
  return response.data;
}
