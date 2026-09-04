const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const siteContentModel = require('../models/siteContentModel');
const {
  sanitizeHistoryHtml,
  hasMeaningfulHistoryContent,
} = require('../utils/historyContentSanitizer');

const router = express.Router();
const HISTORY_CONTENT_KEY = 'history';
const MAX_CONTENT_LENGTH = 100_000;

function parseCoordinate(value, fieldName, min, max) {
  if (value === undefined || value === null || value === '') return null;

  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    const error = new Error(`${fieldName} ต้องอยู่ระหว่าง ${min} ถึง ${max} หรือเว้นว่างได้`);
    error.status = 400;
    throw error;
  }

  return coordinate;
}

router.get(
  '/history',
  asyncHandler(async (_req, res) => {
    const content = await siteContentModel.getSiteContent(HISTORY_CONTENT_KEY);
    if (!content) {
      res.status(404).json({ success: false, message: 'History content not found' });
      return;
    }
    res.json({ success: true, data: content });
  }),
);

router.put(
  '/history',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const contentHtml = req.body?.content_html;
    const latitude = parseCoordinate(req.body?.latitude, 'Latitude', -90, 90);
    const longitude = parseCoordinate(req.body?.longitude, 'Longitude', -180, 180);
    if (typeof contentHtml !== 'string') {
      res.status(400).json({ success: false, message: 'content_html must be a string' });
      return;
    }
    if (contentHtml.length > MAX_CONTENT_LENGTH) {
      res.status(400).json({
        success: false,
        message: `content_html must be ${MAX_CONTENT_LENGTH} characters or fewer`,
      });
      return;
    }

    const sanitizedContent = sanitizeHistoryHtml(contentHtml);
    if (!sanitizedContent || !hasMeaningfulHistoryContent(sanitizedContent)) {
      res.status(400).json({ success: false, message: 'content_html must not be empty' });
      return;
    }

    const saved = await siteContentModel.upsertSiteContent({
      contentKey: HISTORY_CONTENT_KEY,
      contentHtml: sanitizedContent,
      latitude,
      longitude,
      updatedBy: req.user.user_id,
    });
    if (!saved) {
      const error = new Error('History content was saved but could not be reloaded');
      error.status = 500;
      throw error;
    }
    res.json({ success: true, data: saved });
  }),
);

module.exports = router;
