const express = require("express");
const { pool } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function run(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(results);
    });
  });
}

function beginTransaction(connection) {
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

function getConnection() {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(connection);
    });
  });
}

function assertCustomer(user) {
  if (user?.role !== "customer" && user?.role !== "user") {
    const error = new Error("Only customer users can checkout");
    error.status = 403;
    throw error;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Cart items are required");
    error.status = 400;
    throw error;
  }

  return items.map((item) => {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error("Invalid cart item");
      error.status = 400;
      throw error;
    }

    return { product_id: productId, quantity };
  });
}

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    assertCustomer(req.user);

    const {
      items,
      shipping_name,
      shipping_phone,
      shipping_address,
      payment_method,
      transaction_ref,
      slip_image,
    } = req.body;

    if (!shipping_name || !shipping_phone || !shipping_address) {
      res.status(400).json({ success: false, message: "Shipping information is required" });
      return;
    }

    if (!["promptpay", "bank_transfer"].includes(payment_method)) {
      res.status(400).json({ success: false, message: "Invalid payment method" });
      return;
    }

    if (!slip_image) {
      res.status(400).json({ success: false, message: "Payment slip is required" });
      return;
    }

    const normalizedItems = normalizeItems(items);
    const productIds = [...new Set(normalizedItems.map((item) => item.product_id))];
    const connection = await getConnection();

    try {
      await beginTransaction(connection);

      const products = await run(
        connection,
        `SELECT product_id, product_name, price, stock_quantity
         FROM products
         WHERE product_id IN (?)
         FOR UPDATE`,
        [productIds]
      );
      const productMap = new Map(products.map((product) => [Number(product.product_id), product]));

      let totalAmount = 0;

      for (const item of normalizedItems) {
        const product = productMap.get(item.product_id);

        if (!product) {
          const error = new Error("Product not found");
          error.status = 400;
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
        [
          req.user.user_id,
          totalAmount,
          shipping_name.trim(),
          shipping_phone.trim(),
          shipping_address.trim(),
        ]
      );
      const orderId = orderResult.insertId;

      for (const item of normalizedItems) {
        const product = productMap.get(item.product_id);

        await run(
          connection,
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [orderId, item.product_id, item.quantity, product.price]
        );

        await run(
          connection,
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`,
          [item.quantity, item.product_id]
        );
      }

      const paymentResult = await run(
        connection,
        `INSERT INTO payments
          (order_id, slip_image, amount, payment_method, payment_status, transaction_ref, payment_date)
         VALUES (?, ?, ?, ?, 'pending', ?, NOW())`,
        [
          orderId,
          slip_image,
          totalAmount,
          payment_method,
          transaction_ref?.trim() || `ORD${orderId}`,
        ]
      );

      await commit(connection);

      res.status(201).json({
        success: true,
        data: {
          order: {
            order_id: orderId,
            user_id: req.user.user_id,
            total_amount: totalAmount,
            order_status: "pending",
            shipping_name,
            shipping_phone,
            shipping_address,
          },
          payment: {
            payment_id: paymentResult.insertId,
            order_id: orderId,
            amount: totalAmount,
            payment_method,
            payment_status: "pending",
            transaction_ref: transaction_ref?.trim() || `ORD${orderId}`,
            slip_image,
          },
        },
      });
    } catch (error) {
      await rollback(connection);
      throw error;
    } finally {
      connection.release();
    }
  })
);

module.exports = router;
