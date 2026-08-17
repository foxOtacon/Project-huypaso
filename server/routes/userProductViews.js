const express = require("express");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const { invalidateRecommendationCache } = require("./productRecommendations");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, authorize("customer", "user"));

function getRows(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function incrementProductView(userId, productId) {
  const updateExisting = () => query(
    `UPDATE user_product_views
     SET view_count = view_count + 1,
         viewed_at = NOW()
     WHERE view_id = (
       SELECT view_id
       FROM user_product_views
       WHERE user_id = ? AND product_id = ?
       ORDER BY viewed_at DESC, view_id DESC
       LIMIT 1
     )
     RETURNING view_id, user_id, product_id, view_count, viewed_at`,
    [userId, productId],
  );

  let rows = getRows(await updateExisting());
  if (rows.length > 0) return rows[0];

  try {
    const inserted = await query(
      `INSERT INTO user_product_views (user_id, product_id, view_count, viewed_at)
       VALUES (?, ?, 1, NOW())
       RETURNING view_id, user_id, product_id, view_count, viewed_at`,
      [userId, productId],
    );
    rows = getRows(inserted);
    return rows[0] || null;
  } catch (error) {
    if (error.code !== "23505") throw error;
    rows = getRows(await updateExisting());
    return rows[0] || null;
  }
}

router.post(
  "/:productId",
  asyncHandler(async (req, res) => {
    const productId = Number.parseInt(req.params.productId, 10);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "รหัสสินค้าไม่ถูกต้อง" });
      return;
    }

    const products = await query(
      `SELECT product_id
       FROM products
       WHERE product_id = ? AND status = 'active'
       LIMIT 1`,
      [productId],
    );
    if (products.length === 0) {
      res.status(404).json({ success: false, message: "ไม่พบสินค้าที่ต้องการบันทึก" });
      return;
    }

    const userId = Number(req.user.user_id);
    const view = await incrementProductView(userId, productId);
    invalidateRecommendationCache(userId);

    res.json({ success: true, data: view });
  }),
);

module.exports = router;
module.exports.__test = { getRows };
