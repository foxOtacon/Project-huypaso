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

async function saveImageUpload({ fileName, dataUrl, folder }) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");

  if (!match) {
    const error = new Error("Invalid image data");
    error.status = 400;
    throw error;
  }

  const [, mimeType, base64Data] = match;
  const extension = ALLOWED_IMAGE_TYPES.get(mimeType);

  if (!extension) {
    const error = new Error("Unsupported image type");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(base64Data, "base64");
  const maxBytes = 5 * 1024 * 1024;

  if (buffer.length > maxBytes) {
    const error = new Error("Image must be 5MB or smaller");
    error.status = 400;
    throw error;
  }

  const uploadDir = path.join(__dirname, "..", "uploads", folder);
  await fs.mkdir(uploadDir, { recursive: true });

  const safeName = sanitizeBaseName(fileName);
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}.${extension}`;
  const filePath = path.join(uploadDir, uniqueName);

  await fs.writeFile(filePath, buffer);

  return `/uploads/${folder}/${uniqueName}`;
}

router.post(
  "/product-image",
  asyncHandler(async (req, res) => {
    const { fileName, dataUrl } = req.body;
    const url = await saveImageUpload({ fileName, dataUrl, folder: "products" });

    res.status(201).json({
      success: true,
      data: {
        url,
      },
    });
  }),
);

router.post(
  "/payment-slip",
  asyncHandler(async (req, res) => {
    const { fileName, dataUrl } = req.body;
    const url = await saveImageUpload({ fileName, dataUrl, folder: "payments" });

    res.status(201).json({
      success: true,
      data: {
        url,
      },
    });
  }),
);

router.post(
  "/news-image",
  asyncHandler(async (req, res) => {
    const { fileName, dataUrl } = req.body;
    const url = await saveImageUpload({ fileName, dataUrl, folder: "news" });

    res.status(201).json({
      success: true,
      data: {
        url,
      },
    });
  }),
);

module.exports = router;
