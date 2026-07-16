const { query } = require("../config/db");

const PAYMENT_EXPIRATION_MINUTES = Math.max(
  1,
  Number(process.env.PAYMENT_PENDING_EXPIRATION_MINUTES) || 10,
);
const EXPIRATION_CHECK_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.PAYMENT_EXPIRATION_CHECK_INTERVAL_MS) || 30000,
);

async function cancelExpiredUnpaidOrders() {
  const rows = await query(
    `WITH expired_orders AS (
       SELECT o.order_id
       FROM orders o
       WHERE o.order_status = 'pending'
         AND o.order_date <= NOW() - (? * INTERVAL '1 minute')
         AND NOT EXISTS (
           SELECT 1 FROM payments p WHERE p.order_id = o.order_id
         )
       FOR UPDATE SKIP LOCKED
     ),
     cancelled_orders AS (
       UPDATE orders o
       SET order_status = 'cancelled'
       FROM expired_orders e
       WHERE o.order_id = e.order_id
         AND o.order_status = 'pending'
       RETURNING o.order_id
     ),
     restock_totals AS (
       SELECT oi.product_id, SUM(oi.quantity)::int AS quantity
       FROM order_items oi
       INNER JOIN cancelled_orders c ON c.order_id = oi.order_id
       GROUP BY oi.product_id
     ),
     restocked_products AS (
       UPDATE products p
       SET stock_quantity = p.stock_quantity + r.quantity
       FROM restock_totals r
       WHERE p.product_id = r.product_id
       RETURNING p.product_id
     )
     SELECT order_id FROM cancelled_orders ORDER BY order_id`,
    [PAYMENT_EXPIRATION_MINUTES],
  );

  if (rows.length > 0) {
    console.info("[ORDER_EXPIRATION]", {
      time: new Date().toISOString(),
      cancelledOrderIds: rows.map((row) => String(row.order_id)),
      restoredStock: true,
    });
  }

  return rows;
}

function startOrderExpirationJob() {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;

    try {
      await cancelExpiredUnpaidOrders();
    } catch (error) {
      console.error("[ORDER_EXPIRATION_ERROR]", {
        time: new Date().toISOString(),
        message: error.message,
      });
    } finally {
      running = false;
    }
  };

  run();
  const timer = setInterval(run, EXPIRATION_CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  PAYMENT_EXPIRATION_MINUTES,
  cancelExpiredUnpaidOrders,
  startOrderExpirationJob,
};
