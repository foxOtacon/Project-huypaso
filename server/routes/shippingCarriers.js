const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

const controller = createCrudController({
  table: "shipping_carriers",
  idField: "carrier_id",
  fields: ["carrier_name", "tracking_url", "description", "status"],
  requiredFields: ["carrier_name"],
});

router.get("/", asyncHandler(controller.getAll));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", authenticate, authorize("admin"), asyncHandler(controller.create));
router.put("/:id", authenticate, authorize("admin"), asyncHandler(controller.update));
router.delete("/:id", authenticate, authorize("admin"), asyncHandler(controller.remove));

module.exports = router;
