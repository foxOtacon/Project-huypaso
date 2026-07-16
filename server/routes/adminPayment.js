const express = require("express");
const { param } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.get(
  "/payments",
  authenticate,
  authorize("admin"),
  asyncHandler(paymentController.listAdminPayments),
);

router.put(
  "/payment/:id/approve",
  authenticate,
  authorize("admin"),
  [param("id").isInt({ min: 1 })],
  asyncHandler(paymentController.approvePayment),
);

router.put(
  "/payment/:id/reject",
  authenticate,
  authorize("admin"),
  [param("id").isInt({ min: 1 })],
  asyncHandler(paymentController.rejectPayment),
);

module.exports = router;
