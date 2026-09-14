const { pool } = require("../config/db");
const { PAYMENT_EXPIRATION_MINUTES } = require("../services/orderExpirationService");

function getConnection() {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
}

function run(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

function begin(connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function commit(connection) {
  return new Promise((resolve, reject) => {
    connection.commit((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function rollback(connection) {
  return new Promise((resolve) => {
    connection.rollback(() => resolve());
  });
}

async function createOrderWithItems({ userId, items, shippingName, shippingPhone, shippingAddress }) {
  const connection = await getConnection();

  try {
    await begin(connection);

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const products = await run(
      connection,
      `SELECT product_id, product_name, price, stock_quantity, status
       FROM products
       WHERE product_id IN (?)
       FOR UPDATE`,
      [productIds],
    );
    const productMap = new Map(products.map((product) => [Number(product.product_id), product]));
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);

      if (!product) {
        const error = new Error(`Product not found: ${item.product_id}`);
        error.status = 400;
        error.missingProductId = item.product_id;
        throw error;
      }

      if (product.status !== "active") {
        const error = new Error(
          `${product.product_name} ถูกระงับการขายชั่วคราว กรุณานำสินค้าออกจากตะกร้า`,
        );
        error.status = 409;
        throw error;
      }

      if (Number(product.stock_quantity) < item.quantity) {
        const error = new Error(`${product.product_name} does not have enough stock`);
        error.status = 400;
        throw error;
      }

      totalAmount += Number(product.price) * item.quantity;
    }

    const orderResult = await run(
      connection,
      `INSERT INTO orders
        (user_id, total_amount, order_status, shipping_name, shipping_phone, shipping_address)
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      [userId, totalAmount, shippingName, shippingPhone, shippingAddress],
    );
    const orderId = orderResult.insertId;

    await run(
      connection,
      `INSERT INTO payments
        (order_id, amount, payment_method, payment_status, transaction_ref, payment_date)
       VALUES (?, ?, 'promptpay', 'pending', ?, NULL)`,
      [orderId, totalAmount, `ORD${orderId}`],
    );

    for (const item of items) {
      const product = productMap.get(item.product_id);

      await run(
        connection,
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, product.price],
      );

      await run(
        connection,
        `UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`,
        [item.quantity, item.product_id],
      );
    }

    await commit(connection);

    return {
      order_id: orderId,
      user_id: userId,
      total_amount: totalAmount,
      order_status: "pending",
      payment_status: "pending",
      payment_method: "promptpay",
      slip_image: null,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_address: shippingAddress,
    };
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function getOrderForUser(orderId, userId) {
  const connection = await getConnection();

  try {
    const rows = await run(
      connection,
      `SELECT o.*, p.payment_id, p.payment_status, p.payment_method, p.slip_image,
              p.payment_date, p.transaction_ref
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_id = ? AND o.user_id = ?`,
      [orderId, userId],
    );
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

async function createSlipPayment({ orderId, userId, amount, slipImage, paymentMethod }) {
  const connection = await getConnection();

  try {
    await begin(connection);

    const orderRows = await run(
      connection,
      `SELECT o.order_status, o.order_date, p.payment_id, p.payment_status, p.slip_image,
              (o.order_date > NOW() - (? * INTERVAL '1 minute')) AS payment_active
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_id = ? AND o.user_id = ?
       FOR UPDATE OF o, p`,
      [PAYMENT_EXPIRATION_MINUTES, orderId, userId],
    );

    if (!orderRows[0]) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    if (orderRows[0].order_status !== "pending" || orderRows[0].payment_status !== "pending") {
      const error = new Error("Order is no longer awaiting payment");
      error.status = 409;
      throw error;
    }

    if (!orderRows[0].payment_active) {
      const error = new Error("Payment time has expired");
      error.status = 410;
      throw error;
    }

    if (orderRows[0].slip_image) {
      const error = new Error("Payment slip was already submitted");
      error.status = 409;
      throw error;
    }

    await run(
      connection,
      `UPDATE payments
       SET slip_image = ?, amount = ?, payment_method = ?, payment_date = NOW()
       WHERE payment_id = ? AND payment_status = 'pending'`,
      [slipImage, amount, paymentMethod, orderRows[0].payment_id],
    );

    await commit(connection);

    return {
      payment_id: orderRows[0].payment_id,
      order_id: orderId,
      amount,
      slip_image: slipImage,
      payment_method: paymentMethod,
      payment_status: "pending",
    };
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelPendingOrderForUser({ orderId, userId }) {
  const connection = await getConnection();

  try {
    await begin(connection);
    const rows = await run(
      connection,
      `SELECT o.order_id, o.order_status
       FROM orders o
       WHERE o.order_id = ? AND o.user_id = ?
       FOR UPDATE OF o`,
      [orderId, userId],
    );

    if (!rows[0]) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    const paymentRows = await run(connection, "SELECT payment_id, payment_status FROM payments WHERE order_id = ? FOR UPDATE", [orderId]);
    const order = { ...rows[0], ...paymentRows[0] };
    if (order.order_status === "cancelled") {
      await commit(connection);
      return { order_id: order.order_id, order_status: "cancelled", already_cancelled: true };
    }
    if (order.order_status !== "pending") {
      const error = new Error("Only pending orders can be cancelled");
      error.status = 409;
      throw error;
    }
    if (order.payment_status === "approved") {
      const error = new Error("A paid order cannot be cancelled");
      error.status = 409;
      throw error;
    }

    await run(
      connection,
      `UPDATE products p
       SET stock_quantity = p.stock_quantity + restock.quantity
       FROM (
         SELECT product_id, SUM(quantity)::int AS quantity
         FROM order_items
         WHERE order_id = ?
         GROUP BY product_id
       ) restock
       WHERE p.product_id = restock.product_id`,
      [order.order_id],
    );
    await run(connection, `UPDATE payments SET payment_status = 'rejected' WHERE order_id = ? AND payment_status = 'pending'`, [order.order_id]);
    await run(connection, "UPDATE orders SET order_status = 'cancelled', cancellation_reason = 'cancelled_by_user' WHERE order_id = ?", [
      order.order_id,
    ]);
    await commit(connection);
    return { order_id: order.order_id, order_status: "cancelled", already_cancelled: false };
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function listAdminPayments() {
  const connection = await getConnection();

  try {
    return run(
      connection,
      `SELECT
          p.*,
          o.user_id,
          o.total_amount,
          o.order_status,
          o.shipping_name,
          o.shipping_phone,
          o.shipping_address,
          o.order_date,
          u.full_name,
          u.email,
          u.phone
       FROM payments p
       INNER JOIN orders o ON p.order_id = o.order_id
       LEFT JOIN users u ON o.user_id = u.user_id
       ORDER BY COALESCE(p.payment_date, o.order_date) DESC`,
    );
  } finally {
    connection.release();
  }
}

async function approvePayment(paymentId) {
  const connection = await getConnection();

  try {
    await begin(connection);

    const locked = await run(connection, `SELECT p.*, o.order_status FROM payments p INNER JOIN orders o ON o.order_id = p.order_id WHERE p.payment_id = ? FOR UPDATE OF p, o`, [paymentId]);
    if (!locked[0]) {
      const error = new Error("Payment not found"); error.status = 404; throw error;
    }

    if (locked[0].payment_status === "approved") {
      return { ...locked[0], payment_status: "approved" };
    }
    if (locked[0].payment_status === "rejected") {
      return { ...locked[0], payment_status: "rejected" };
    }
    if (locked[0].order_status !== "pending" || locked[0].payment_status !== "pending") {
      const error = new Error("Payment is no longer pending"); error.status = 409; throw error;
    }
    const result = await run(
      connection,
      `UPDATE payments
       SET payment_status = 'approved', payment_date = COALESCE(payment_date, NOW())
       WHERE payment_id = ?`,
      [paymentId],
    );

    if (result.affectedRows === 0) {
      const error = new Error("Payment not found");
      error.status = 404;
      throw error;
    }

    const rows = await run(connection, "SELECT * FROM payments WHERE payment_id = ?", [paymentId]);
    await run(connection, "UPDATE orders SET order_status = 'shipping', cancellation_reason = NULL WHERE order_id = ? AND order_status = 'pending'", [
      rows[0].order_id,
    ]);

    await commit(connection);
    return rows[0];
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectPayment(paymentId) {
  const connection = await getConnection();

  try {
    await begin(connection);

    const rows = await run(
      connection,
      `SELECT p.*, o.order_status
       FROM payments p
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE p.payment_id = ?
       FOR UPDATE OF p, o`,
      [paymentId],
    );

    if (!rows[0]) {
      const error = new Error("Payment not found");
      error.status = 404;
      throw error;
    }

    const payment = rows[0];

    if (payment.payment_status === "rejected") {
      return { ...payment, payment_status: "rejected", order_status: payment.order_status || "cancelled" };
    }

    await run(
      connection,
      "UPDATE payments SET payment_status = 'rejected' WHERE payment_id = ?",
      [paymentId],
    );

    if (payment.order_status !== "cancelled") {
      await run(
        connection,
        `UPDATE products p
         SET stock_quantity = p.stock_quantity + restock.quantity
         FROM (
           SELECT product_id, SUM(quantity)::int AS quantity
           FROM order_items
           WHERE order_id = ?
           GROUP BY product_id
         ) restock
         WHERE p.product_id = restock.product_id`,
        [payment.order_id],
      );

      await run(connection, "UPDATE orders SET order_status = 'cancelled', cancellation_reason = 'payment_rejected' WHERE order_id = ?", [
        payment.order_id,
      ]);
    }

    await commit(connection);
    return {
      ...payment,
      payment_status: "rejected",
      order_status: "cancelled",
    };
  } catch (error) {
    await rollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrderWithItems,
  getOrderForUser,
  createSlipPayment,
  cancelPendingOrderForUser,
  listAdminPayments,
  approvePayment,
  rejectPayment,
};
