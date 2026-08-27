const express = require("express");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const { query } = require("../config/db");

const router = express.Router();
let tableReady;

function ensureTable() {
  if (!tableReady) {
    tableReady = query(`CREATE TABLE IF NOT EXISTS bank_transfer_accounts (
      bank_transfer_account_id BIGSERIAL PRIMARY KEY,
      bank_name VARCHAR(100) NOT NULL,
      account_number VARCHAR(50) NOT NULL UNIQUE,
      account_name VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch((error) => { tableReady = null; throw error; });
  }
  return tableReady;
}

router.use(asyncHandler(async (_req, _res, next) => {
  await ensureTable();
  next();
}));
const controller = createCrudController({
  table: "bank_transfer_accounts",
  idField: "bank_transfer_account_id",
  fields: ["bank_name", "account_number", "account_name", "status"],
  requiredFields: ["bank_name", "account_number", "account_name"],
});

router.get("/", asyncHandler(controller.getAll));
router.post("/", authenticate, authorize("admin"), asyncHandler(controller.create));
router.put("/:id", authenticate, authorize("admin"), asyncHandler(controller.update));
router.delete("/:id", authenticate, authorize("admin"), asyncHandler(controller.remove));

module.exports = router;
