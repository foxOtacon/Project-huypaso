const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const controller = createCrudController({
  table: "products",
  idField: "product_id",
  fields: [
    "product_name",
    "category_id",
    "description",
    "price",
    "unit",
    "image_url",
    "planting_date",
    "harvest_date",
    "production_source",
    "stock_quantity",
    "created_by",
  ],
  requiredFields: ["product_name", "category_id", "unit", "created_by"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
