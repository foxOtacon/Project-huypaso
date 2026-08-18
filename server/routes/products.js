const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");
const { deleteStoredImage } = require('../services/storageService');

const router = express.Router();

function resolveLocalProductImage(imageUrl) {
  if (!imageUrl) return null;

  let pathname;
  try {
    pathname = new URL(imageUrl, "http://localhost").pathname;
  } catch {
    return null;
  }

  const prefix = "/uploads/products/";
  if (!pathname.startsWith(prefix)) return null;

  const relativeName = decodeURIComponent(pathname.slice(prefix.length));
  const fileName = path.basename(relativeName);
  if (!fileName || fileName !== relativeName) return null;

  return path.join(__dirname, "..", "uploads", "products", fileName);
}

async function removeReplacedProductImage(previous, updated) {
  if (!previous?.image_url || previous.image_url === updated?.image_url) return;
  if (previous.image_url.includes('/storage/v1/object/public/')) {
    await deleteStoredImage(previous.image_url);
    return;
  }

  const oldImagePath = resolveLocalProductImage(previous.image_url);
  if (!oldImagePath) return;

  try {
    await fs.unlink(oldImagePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

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
    "production_source",
    "stock_quantity",
    "status",
    "created_by",
  ],
  requiredFields: ["product_name", "category_id", "unit", "created_by"],
  afterUpdate: removeReplacedProductImage,
});

const validateUniqueProductName = asyncHandler(async (req, res, next) => {
  const productName = String(req.body?.product_name || '').trim();
  if (!productName) return next();
  const params = [productName];
  let sql = 'SELECT product_id FROM products WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?))';
  if (req.params.id) { sql += ' AND product_id <> ?'; params.push(req.params.id); }
  if ((await query(sql, params)).length) {
    res.status(409).json({ success: false, code: 'DUPLICATE_PRODUCT_NAME', message: 'ชื่อสินค้าซ้ำ กรุณาใช้ชื่ออื่น' });
    return;
  }
  next();
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT * FROM products WHERE status = 'active' ORDER BY product_id DESC",
    );
    res.json({ success: true, data: rows });
  }),
);
router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  asyncHandler(controller.getAll),
);
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const rows = await query(
      "SELECT * FROM products WHERE product_id = ? AND status = 'active'",
      [req.params.id],
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    res.json({ success: true, data: rows[0] });
  }),
);
router.post("/", authenticate, authorize("admin"), validateUniqueProductName, asyncHandler(controller.create));
router.put("/:id", authenticate, authorize("admin"), validateUniqueProductName, asyncHandler(controller.update));
router.delete("/:id", authenticate, authorize("admin"), asyncHandler(controller.remove));

module.exports = router;
