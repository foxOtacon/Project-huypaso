const express = require("express");
const multer = require("multer");
const { body, param } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only jpg, jpeg, and png slip images are allowed"));
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/create-order",
  authenticate,
  [
    body("items").isArray({ min: 1 }).withMessage("Cart items are required"),
    body("items.*.product_id").isInt({ min: 1 }).withMessage("Product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("shipping_name").trim().notEmpty().withMessage("Shipping name is required"),
    body("shipping_phone").trim().notEmpty().withMessage("Shipping phone is required"),
    body("shipping_address").trim().notEmpty().withMessage("Shipping address is required"),
  ],
  asyncHandler(paymentController.createOrder),
);

router.get(
  "/promptpay/:orderId",
  authenticate,
  [param("orderId").isInt({ min: 1 })],
  asyncHandler(paymentController.getPromptPayQr),
);

router.post(
  "/upload-slip",
  authenticate,
  upload.single("slip"),
  [
    body("orderId").isInt({ min: 1 }),
    body("paymentMethod").optional().isIn(["promptpay", "bank_transfer"]),
  ],
  asyncHandler(paymentController.uploadSlip),
);

router.delete(
  "/order/:orderId",
  authenticate,
  [param("orderId").isInt({ min: 1 })],
  asyncHandler(paymentController.cancelOrder),
);

router.get(
  "/admin/payments",
  authenticate,
  authorize("admin"),
  asyncHandler(paymentController.listAdminPayments),
);

router.put(
  "/admin/payment/:id/approve",
  authenticate,
  authorize("admin"),
  [param("id").isInt({ min: 1 })],
  asyncHandler(paymentController.approvePayment),
);

router.put(
  "/admin/payment/:id/reject",
  authenticate,
  authorize("admin"),
  [param("id").isInt({ min: 1 })],
  asyncHandler(paymentController.rejectPayment),
);

module.exports = router;
