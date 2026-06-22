const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const controller = createCrudController({
  table: "cart_items",
  idField: "cart_item_id",
  fields: ["cart_id", "product_id", "quantity", "unit_price"],
  requiredFields: ["cart_id", "product_id"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
