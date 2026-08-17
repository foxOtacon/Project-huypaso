const express = require("express");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;
const recommendationCache = new Map();
const pendingRecommendations = new Map();

router.use(authenticate, authorize("customer", "user"));

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function getCacheTtlMs() {
  const configured = Number.parseInt(process.env.RECOMMENDATIONS_CACHE_TTL_MS, 10);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_CACHE_TTL_MS;
}

function getRecommendationReason(row) {
  if (Number(row.personal_view_count) > 0) {
    return "จากสินค้าที่คุณเคยเข้าชมและสนใจ";
  }
  if (Number(row.category_affinity) > 0) {
    return "อยู่ในหมวดหมู่สินค้าที่คุณสนใจ";
  }
  if (Number(row.global_views) > 0) {
    return "สินค้าที่กำลังได้รับความสนใจจากลูกค้า";
  }
  return "สินค้าใหม่ที่คัดสรรจากชุมชน";
}

function calculateRecommendationScore(row) {
  const personalViews = Math.min(Math.max(Number(row.personal_view_count) || 0, 0), 10);
  const categoryAffinity = Math.min(Math.max(Number(row.category_affinity) || 0, 0), 20);
  const globalViews = Math.min(Math.max(Number(row.global_views) || 0, 0), 20);
  const hasPersonalSignal = personalViews > 0 || categoryAffinity > 0;
  const baseScore = hasPersonalSignal ? 45 : 35;

  return Math.min(
    100,
    Math.round(baseScore + (personalViews * 3) + (categoryAffinity * 2) + globalViews),
  );
}

function serializeRecommendation(row) {
  return {
    product_id: Number(row.product_id),
    product_name: row.product_name,
    category_id: Number(row.category_id),
    category_name: row.category_name || null,
    description: row.description || null,
    price: Number(row.price || 0),
    unit: row.unit,
    image_url: row.image_url || null,
    production_source: row.production_source || null,
    stock_quantity: Number(row.stock_quantity || 0),
    status: row.status,
    score: calculateRecommendationScore(row),
    reason: getRecommendationReason(row),
  };
}

async function buildRecommendations(userId, limit) {
  const rows = await query(
    `WITH category_affinity AS (
       SELECT p.category_id, SUM(GREATEST(upv.view_count, 0))::int AS affinity
       FROM user_product_views upv
       INNER JOIN products p ON p.product_id = upv.product_id
       WHERE upv.user_id = ?
         AND upv.viewed_at >= NOW() - INTERVAL '365 days'
       GROUP BY p.category_id
     ),
     personal_views AS (
       SELECT product_id, SUM(GREATEST(view_count, 0))::int AS view_count,
              MAX(viewed_at) AS last_viewed_at
       FROM user_product_views
       WHERE user_id = ?
         AND viewed_at >= NOW() - INTERVAL '365 days'
       GROUP BY product_id
     ),
     global_popularity AS (
       SELECT product_id, SUM(GREATEST(view_count, 0))::int AS global_views
       FROM user_product_views
       WHERE viewed_at >= NOW() - INTERVAL '90 days'
       GROUP BY product_id
     )
     SELECT p.product_id, p.product_name, p.category_id, c.category_name,
            p.description, p.price, p.unit, p.image_url, p.production_source,
            p.stock_quantity, p.status,
            COALESCE(ca.affinity, 0) AS category_affinity,
            COALESCE(pv.view_count, 0) AS personal_view_count,
            pv.last_viewed_at,
            COALESCE(gp.global_views, 0) AS global_views
     FROM products p
     LEFT JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN category_affinity ca ON ca.category_id = p.category_id
     LEFT JOIN personal_views pv ON pv.product_id = p.product_id
     LEFT JOIN global_popularity gp ON gp.product_id = p.product_id
     WHERE p.status = 'active'
       AND p.stock_quantity > 0
     ORDER BY COALESCE(ca.affinity, 0) DESC,
              COALESCE(pv.view_count, 0) DESC,
              pv.last_viewed_at DESC NULLS LAST,
              COALESCE(gp.global_views, 0) DESC,
              p.product_id DESC
     LIMIT ?`,
    [userId, userId, limit],
  );

  const hasPersonalizedSignals = rows.some(
    (row) => Number(row.category_affinity) > 0 || Number(row.personal_view_count) > 0,
  );

  return {
    user_id: Number(userId),
    strategy: hasPersonalizedSignals ? "personalized" : "popular",
    generated_at: new Date().toISOString(),
    recommendations: rows.map(serializeRecommendation),
  };
}

function invalidateRecommendationCache(userId) {
  const prefix = `${userId}:`;
  for (const key of recommendationCache.keys()) {
    if (key.startsWith(prefix)) recommendationCache.delete(key);
  }
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = Number(req.user.user_id);
    const limit = normalizeLimit(req.body?.limit);
    const cacheKey = `${userId}:${limit}`;
    const cached = recommendationCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      res.json({ success: true, data: cached.data, meta: { cached: true } });
      return;
    }

    let pending = pendingRecommendations.get(cacheKey);
    if (!pending) {
      pending = buildRecommendations(userId, limit);
      pendingRecommendations.set(cacheKey, pending);
    }

    try {
      const data = await pending;
      recommendationCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + getCacheTtlMs(),
      });
      res.json({ success: true, data, meta: { cached: false } });
    } finally {
      if (pendingRecommendations.get(cacheKey) === pending) {
        pendingRecommendations.delete(cacheKey);
      }
    }
  }),
);

module.exports = router;
module.exports.invalidateRecommendationCache = invalidateRecommendationCache;
module.exports.__test = {
  calculateRecommendationScore,
  getRecommendationReason,
  normalizeLimit,
  serializeRecommendation,
};
