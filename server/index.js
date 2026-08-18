const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const categoriesRoutes = require("./routes/categories");
const productsRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const cartItemsRoutes = require("./routes/cartItems");
const ordersRoutes = require("./routes/orders");
const orderItemsRoutes = require("./routes/orderItems");
const paymentsRoutes = require("./routes/payments");
const checkoutRoutes = require("./routes/checkout");
const paymentRoutes = require("./routes/payment");
const paymentSettingsRoutes = require("./routes/paymentSettings");
const adminPaymentRoutes = require("./routes/adminPayment");
const adminAnalyticsRoutes = require("./routes/adminAnalytics");
const newsRoutes = require("./routes/news");
const salesPredictionRoutes = require("./routes/salesPrediction");
const userProductViewsRoutes = require("./routes/userProductViews");
const productRecommendationsRoutes = require("./routes/productRecommendations");
const uploadsRoutes = require("./routes/uploads");
const shippingCarriersRoutes = require("./routes/shippingCarriers");
const automationRoutes = require("./routes/automation");
const siteContentRoutes = require("./routes/siteContent");
const { startOrderExpirationJob } = require("./services/orderExpirationService");

const app = express();
const PORT = process.env.PORT || 5000;

function getDuplicateEntryMessage(error) {
  const duplicateTarget = [
    error.constraint,
    error.detail,
    error.sqlMessage,
    error.message,
  ].filter(Boolean).join(" ").toLowerCase();

  if (duplicateTarget.includes("category")) {
    return "มีชื่อหมวดหมู่นี้อยู่แล้ว";
  }

  if (duplicateTarget.includes("carrier")) {
    return "มีชื่อบริษัทขนส่งนี้อยู่แล้ว";
  }

  if (duplicateTarget.includes("email")) {
    return "อีเมลนี้ถูกใช้งานแล้ว";
  }

  if (duplicateTarget.includes("sales_prediction")) {
    return "มีผลพยากรณ์ของสินค้าและเดือนนี้อยู่แล้ว";
  }

  return "ข้อมูลนี้มีอยู่แล้ว";
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Village Products API",
    endpoints: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        me: "GET /api/auth/me",
      },
      users: "/api/users",
      categories: "/api/categories",
      products: "/api/products",
      cart: "/api/cart",
      cartItems: "/api/cart-items",
      orders: "/api/orders",
      orderItems: "/api/order-items",
      payments: "/api/payments",
      news: "/api/news",
      checkout: "POST /api/checkout",
      payment: {
        createOrder: "POST /api/payment/create-order",
        promptPayQr: "GET /api/payment/promptpay/:orderId",
        uploadSlip: "POST /api/payment/upload-slip",
        adminPayments: "GET /api/admin/payments",
      },
      salesPrediction: "/api/sales-prediction",
      adminAnalytics: "/api/admin/analytics",
      userProductViews: "/api/user-product-views",
      productRecommendations: "POST /api/product-recommendations",
      uploads: "/api/uploads",
      shippingCarriers: "/api/shipping-carriers",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/cart-items", cartItemsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/order-items", orderItemsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin", adminPaymentRoutes);
app.use("/api/sales-prediction", salesPredictionRoutes);
app.use("/api/user-product-views", userProductViewsRoutes);
app.use("/api/product-recommendations", productRecommendationsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/shipping-carriers", shippingCarriersRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/site-content", siteContentRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((error, req, res, _next) => {
  console.error(error);

  if (error.code === "ER_DUP_ENTRY" || error.code === "23505") {
    res.status(409).json({ success: false, message: getDuplicateEntryMessage(error) });
    return;
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ success: false, message: "File must be 5MB or smaller" });
    return;
  }

  if (error.message === "Only jpg, jpeg, and png slip images are allowed") {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  if (
    error.code === "ER_NO_REFERENCED_ROW_2" ||
    error.code === "ER_ROW_IS_REFERENCED_2" ||
    error.code === "23503"
  ) {
    const isDeletingUser =
      req.method === "DELETE" && /^\/api\/users\/[^/]+\/?$/.test(req.originalUrl || req.url);

    if (isDeletingUser) {
      res.status(409).json({
        success: false,
        code: "USER_HAS_REFERENCES",
        message:
          "ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีสินค้า คำสั่งซื้อ หรือประวัติการใช้งานเชื่อมโยงอยู่ กรุณาระงับบัญชีแทนการลบ",
      });
      return;
    }

    res.status(409).json({
      success: false,
      code: "FOREIGN_KEY_CONFLICT",
      message: "ไม่สามารถดำเนินการได้ เนื่องจากข้อมูลนี้เชื่อมโยงกับข้อมูลอื่นอยู่",
    });
    return;
  }

  if (error.status) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// เริ่มเซิร์ฟเวอร์เฉพาะตอนรันในเครื่อง
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // ใช้ได้เฉพาะตอนรันเป็นเซิร์ฟเวอร์ปกติในเครื่องหรือ VPS
    startOrderExpirationJob();
  });
}

// ส่ง Express app ให้ Vercel
module.exports = app;
