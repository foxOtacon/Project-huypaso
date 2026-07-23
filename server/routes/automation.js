const crypto = require("crypto");
const express = require("express");
const { query } = require("../config/db");
const automationAuth = require("../middleware/automationAuth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(automationAuth);

function anonymousUserId(userId) {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.N8N_API_KEY || "analytics";
  return crypto.createHash("sha256").update(`${salt}:${userId}`).digest("hex").slice(0, 16);
}

router.get("/analysis-data", asyncHandler(async (req, res) => {
  const requested = Number.parseInt(req.query.months, 10);
  const months = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 36) : 12;
  const [products, salesHistory, userBehavior, userSummary] = await Promise.all([
    query(`SELECT p.product_id, p.product_name, p.price, p.stock_quantity, p.unit,
                  c.category_name
           FROM products p LEFT JOIN categories c ON c.category_id = p.category_id
           ORDER BY p.product_id`),
    query(`SELECT oi.product_id, DATE_TRUNC('month', o.order_date)::date AS sales_month,
                  SUM(oi.quantity)::int AS quantity_sold,
                  SUM(oi.quantity * oi.price)::numeric(12,2) AS revenue,
                  COUNT(DISTINCT o.order_id)::int AS order_count,
                  COUNT(DISTINCT o.user_id)::int AS customer_count
           FROM order_items oi INNER JOIN orders o ON o.order_id = oi.order_id
           WHERE o.order_status <> 'cancelled'
             AND o.order_date >= DATE_TRUNC('month', CURRENT_DATE) - (? * INTERVAL '1 month')
           GROUP BY oi.product_id, DATE_TRUNC('month', o.order_date)
           ORDER BY sales_month, oi.product_id`, [months]),
    query(`SELECT upv.user_id, upv.product_id, upv.view_count, upv.viewed_at,
                  EXISTS (SELECT 1 FROM orders o INNER JOIN order_items oi ON oi.order_id = o.order_id
                          WHERE o.user_id = upv.user_id AND oi.product_id = upv.product_id
                            AND o.order_status <> 'cancelled') AS has_purchased
           FROM user_product_views upv
           WHERE upv.viewed_at >= CURRENT_DATE - (? * INTERVAL '1 month')
           ORDER BY upv.viewed_at DESC`, [months]),
    query(`SELECT COUNT(DISTINCT u.user_id) FILTER (WHERE role = 'customer')::int AS total_customers,
                  COUNT(DISTINCT u.user_id) FILTER (WHERE role = 'customer' AND created_at >= CURRENT_DATE - INTERVAL '30 days')::int AS new_customers_30d,
                  COUNT(DISTINCT o.user_id) FILTER (WHERE o.order_status <> 'cancelled')::int AS purchasing_customers,
                  COUNT(DISTINCT o.user_id) FILTER (WHERE o.order_status <> 'cancelled' AND o.order_date >= CURRENT_DATE - INTERVAL '30 days')::int AS active_customers_30d
           FROM users u LEFT JOIN orders o ON o.user_id = u.user_id`),
  ]);
  res.json({ success: true, generated_at: new Date().toISOString(), period_months: months, data: {
    products,
    sales_history: salesHistory,
    user_summary: userSummary[0] || {},
    user_behavior: userBehavior.map((row) => ({
      anonymous_user_id: anonymousUserId(row.user_id), product_id: row.product_id,
      view_count: row.view_count, viewed_at: row.viewed_at, has_purchased: row.has_purchased,
    })),
  } });
}));

router.post("/predictions", asyncHandler(async (req, res) => {
  const predictions = Array.isArray(req.body.predictions) ? req.body.predictions : [];
  if (!predictions.length || predictions.length > 500) {
    res.status(400).json({ success: false, message: "predictions must contain 1-500 items" });
    return;
  }
  const normalized = predictions.map((item) => ({
    productId: Number.parseInt(item.product_id, 10),
    quantity: Number.parseInt(item.predicted_quantity, 10),
    month: String(item.predicted_month || "").slice(0, 10),
  }));
  const invalid = normalized.some((item) => !Number.isInteger(item.productId) || item.productId < 1
    || !Number.isInteger(item.quantity) || item.quantity < 0 || !/^\d{4}-\d{2}-01$/.test(item.month));
  if (invalid) {
    res.status(400).json({ success: false, message: "Each item requires product_id, non-negative predicted_quantity, and predicted_month as YYYY-MM-01" });
    return;
  }
  const saved = [];
  for (const item of normalized) {
    const rows = await query(
      `INSERT INTO sales_prediction (product_id, predicted_quantity, predicted_month)
       VALUES (?, ?, ?)
       ON CONFLICT (product_id, predicted_month)
       DO UPDATE SET predicted_quantity = EXCLUDED.predicted_quantity, created_at = NOW()
       RETURNING prediction_id, product_id, predicted_quantity, predicted_month, created_at`,
      [item.productId, item.quantity, item.month],
    );
    saved.push(rows[0]);
  }
  res.json({ success: true, saved_count: saved.length, data: saved });
}));

module.exports = router;
