const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function contactRequest(path, options = {}) {
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
  if (!response.ok) throw new Error(data.message || 'ไม่สามารถดำเนินการได้');
  return data.data;
}

export const createContactTicket = (payload) => contactRequest('/contact', { method: 'POST', body: JSON.stringify(payload) });
export const fetchMyContactTickets = () => contactRequest('/contact/mine');
export const fetchContactTicket = (id) => contactRequest(`/contact/${id}`);
export const replyContactTicket = (id, message) => contactRequest(`/contact/${id}/replies`, { method: 'POST', body: JSON.stringify({ message }) });
