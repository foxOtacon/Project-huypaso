const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { uploadImage } = require('../services/storageService');

const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const historyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const error = new Error('รองรับเฉพาะไฟล์ JPEG, PNG, WebP และ GIF');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

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
  if (buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error("Image must be 5MB or smaller");
    error.status = 400;
    throw error;
  }

  return uploadImage({ buffer, contentType: mimeType, fileName, folder, extension });
}

async function saveHistoryImage(file) {
  const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype);
  return uploadImage({
    buffer: file.buffer,
    contentType: file.mimetype,
    fileName: file.originalname,
    folder: 'history',
    extension,
  });
}

router.post(
  "/product-image",
  authenticate,
  authorize('admin'),
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
  authenticate,
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
  authenticate,
  authorize('admin'),
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

router.post(
  '/history-image',
  authenticate,
  authorize('admin'),
  historyImageUpload.single('upload'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพ' });
      return;
    }
    const url = await saveHistoryImage(req.file);
    res.status(201).json({ success: true, data: { url }, url });
  }),
);

module.exports = router;
