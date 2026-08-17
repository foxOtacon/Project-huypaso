const { query } = require("../config/db");

const PAYMENT_EXPIRATION_MINUTES = Math.max(
  1,
  Number(process.env.PAYMENT_PENDING_EXPIRATION_MINUTES) || 10,
);
const EXPIRATION_CHECK_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.PAYMENT_EXPIRATION_CHECK_INTERVAL_MS) || 30000,
);
const DB_RETRY_ATTEMPTS = Math.max(1, Number(process.env.PAYMENT_EXPIRATION_DB_RETRY_ATTEMPTS) || 3);
const DB_RETRY_BASE_DELAY_MS = Math.max(
  100,
  Number(process.env.PAYMENT_EXPIRATION_DB_RETRY_DELAY_MS) || 1000,
);

function isTransientDatabaseError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    ["EAUTHQUERY", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P01", "57P03"].includes(code) ||
    message.includes("secret check timed out") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("timeout expired")
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithRetry(sql, params) {
  let attempt = 1;

  while (true) {
    try {
      return await query(sql, params);
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= DB_RETRY_ATTEMPTS) throw error;

      const delayMs = DB_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn("[ORDER_EXPIRATION_RETRY]", {
        time: new Date().toISOString(),
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        code: error.code,
        message: error.message,
      });
      await wait(delayMs);
      attempt += 1;
    }
  }
}

async function cancelExpiredUnpaidOrders() {
  const rows = await queryWithRetry(
    `WITH expired_orders AS (
       SELECT o.order_id
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_status = 'pending'
         AND p.payment_status = 'pending'
         AND p.slip_image IS NULL
         AND o.order_date <= NOW() - (? * INTERVAL '1 minute')
       FOR UPDATE OF o, p SKIP LOCKED
     ),
     cancelled_orders AS (
       UPDATE orders o
       SET order_status = 'cancelled', cancellation_reason = 'payment_expired'
       FROM expired_orders e
       WHERE o.order_id = e.order_id
         AND o.order_status = 'pending'
       RETURNING o.order_id
     ),
     expired_payments AS (
       UPDATE payments p
       SET payment_status = 'rejected'
       FROM cancelled_orders c
       WHERE p.order_id = c.order_id AND p.payment_status = 'pending'
       RETURNING p.order_id
     ),
     restock_totals AS (
       SELECT oi.product_id, SUM(oi.quantity)::int AS quantity
       FROM order_items oi
       INNER JOIN expired_payments c ON c.order_id = oi.order_id
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
  isTransientDatabaseError,
  startOrderExpirationJob,
};
