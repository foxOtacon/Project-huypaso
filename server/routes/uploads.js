const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function sanitizeBaseName(fileName = "image") {
  const parsed = path.parse(fileName);
  return parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
}

router.post(
  "/product-image",
  asyncHandler(async (req, res) => {
    const { fileName, dataUrl } = req.body;
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");

    if (!match) {
      res.status(400).json({ success: false, message: "Invalid image data" });
      return;
    }

    const [, mimeType, base64Data] = match;
    const extension = ALLOWED_IMAGE_TYPES.get(mimeType);

    if (!extension) {
      res.status(400).json({ success: false, message: "Unsupported image type" });
      return;
    }

    const buffer = Buffer.from(base64Data, "base64");
    const maxBytes = 5 * 1024 * 1024;

    if (buffer.length > maxBytes) {
      res.status(400).json({ success: false, message: "Image must be 5MB or smaller" });
      return;
    }

    const uploadDir = path.join(__dirname, "..", "uploads", "products");
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeBaseName(fileName);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}.${extension}`;
    const filePath = path.join(uploadDir, uniqueName);

    await fs.writeFile(filePath, buffer);

    res.status(201).json({
      success: true,
      data: {
        url: `/uploads/products/${uniqueName}`,
      },
    });
  }),
);

module.exports = router;
