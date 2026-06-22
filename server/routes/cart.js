const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const controller = createCrudController({
  table: "cart",
  idField: "cart_id",
  fields: ["user_id"],
  requiredFields: ["user_id"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
