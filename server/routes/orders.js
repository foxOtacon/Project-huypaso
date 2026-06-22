const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");

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
  ],
  requiredFields: ["user_id"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
