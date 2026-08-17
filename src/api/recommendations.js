import { handleInvalidSession } from '../utils/session';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const CLIENT_CACHE_TTL_MS = 60 * 1000;
const VIEW_DEDUPE_TTL_MS = 30 * 1000;
const recommendationCache = new Map();
const pendingRecommendationRequests = new Map();
const recentProductViews = new Map();

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidSession(response, data);
    const error = new Error(data.message || 'ไม่สามารถโหลดสินค้าแนะนำได้');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function fetchProductRecommendations(token, limit = 5) {
  if (!token) return { recommendations: [], strategy: 'guest' };

  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 3, 1), 5);
  const cacheKey = `${token}:${normalizedLimit}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  if (pendingRecommendationRequests.has(cacheKey)) {
    return pendingRecommendationRequests.get(cacheKey);
  }

  const pending = request('/product-recommendations', token, {
    method: 'POST',
    body: JSON.stringify({ limit: normalizedLimit }),
  }).then((response) => {
    const data = response.data || { recommendations: [], strategy: 'popular' };
    recommendationCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
    });
    return data;
  });

  pendingRecommendationRequests.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    pendingRecommendationRequests.delete(cacheKey);
  }
}

export async function recordProductView(token, productId) {
  const normalizedProductId = Number(productId);
  if (!token || !Number.isInteger(normalizedProductId) || normalizedProductId < 1) return null;

  const viewKey = `${token}:${normalizedProductId}`;
  const lastRecordedAt = recentProductViews.get(viewKey) || 0;
  if (Date.now() - lastRecordedAt < VIEW_DEDUPE_TTL_MS) return null;

  recentProductViews.set(viewKey, Date.now());
  for (const key of recommendationCache.keys()) {
    if (key.startsWith(`${token}:`)) recommendationCache.delete(key);
  }

  try {
    const response = await request(`/user-product-views/${normalizedProductId}`, token, {
      method: 'POST',
    });
    return response.data || null;
  } catch (error) {
    recentProductViews.delete(viewKey);
    throw error;
  }
}
