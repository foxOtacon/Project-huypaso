const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const controller = createCrudController({
  table: "payments",
  idField: "payment_id",
  fields: [
    "order_id",
    "slip_image",
    "amount",
    "payment_method",
    "payment_status",
    "transaction_ref",
    "payment_date",
  ],
  requiredFields: ["order_id", "payment_method"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
