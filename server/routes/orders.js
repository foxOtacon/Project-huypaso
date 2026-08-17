const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { query } = require("../config/db");
const { PAYMENT_EXPIRATION_MINUTES, cancelExpiredUnpaidOrders } = require("../services/orderExpirationService");

const router = express.Router();

const controller = createCrudController({
  table: "orders",
  idField: "order_id",
  fields: [
    "user_id",
    "total_amount",
    "order_status",
    "shipping_name",
    "shipping_phone",
    "shipping_address",
    "tracking_number",
    "shipping_carrier",
    "tracking_url",
  ],
  requiredFields: ["user_id"],
});


router.get(
  "/my",
  authenticate,
  asyncHandler(async (req, res) => {
    await cancelExpiredUnpaidOrders();
    const rows = await query(
      `SELECT
          o.*,
          p.payment_id,
          p.payment_method,
          p.payment_status,
          p.payment_date,
          p.slip_image,
          (o.order_date + (? * INTERVAL '1 minute')) AS payment_expires_at,
          GREATEST(0, EXTRACT(EPOCH FROM (o.order_date + (? * INTERVAL '1 minute') - NOW())))::int AS expires_in_seconds
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE o.user_id = ?
       ORDER BY o.order_date DESC, o.order_id DESC`,
      [PAYMENT_EXPIRATION_MINUTES, PAYMENT_EXPIRATION_MINUTES, req.user.user_id],
    );

    res.json({ success: true, data: rows });
  }),
);

router.get(
  "/my/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await cancelExpiredUnpaidOrders();
    const orderRows = await query(
      `SELECT
          o.*,
          p.payment_id,
          p.payment_method,
          p.payment_status,
          p.payment_date,
          p.slip_image,
          p.transaction_ref,
          (o.order_date + (? * INTERVAL '1 minute')) AS payment_expires_at,
          GREATEST(0, EXTRACT(EPOCH FROM (o.order_date + (? * INTERVAL '1 minute') - NOW())))::int AS expires_in_seconds
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_id = ? AND o.user_id = ?
       LIMIT 1`,
      [PAYMENT_EXPIRATION_MINUTES, PAYMENT_EXPIRATION_MINUTES, req.params.id, req.user.user_id],
    );

    if (orderRows.length === 0) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const itemRows = await query(
      `SELECT
          oi.order_item_id,
          oi.order_id,
          oi.product_id,
          oi.quantity,
          oi.price,
          p.product_name,
          p.unit,
          p.image_url
       FROM order_items oi
       LEFT JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.order_item_id ASC`,
      [req.params.id],
    );

    res.json({
      success: true,
      data: {
        ...orderRows[0],
        items: itemRows,
      },
    });
  }),
);
router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
