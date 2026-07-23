const express = require("express");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 36;
const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;
const DEFAULT_STALE_RUN_MINUTES = 30;

router.use(authenticate, authorize("admin"));

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMonths(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MONTHS;
  return Math.min(Math.max(parsed, 1), MAX_MONTHS);
}

function getWebhookConfig() {
  const url = String(process.env.N8N_SALES_ANALYSIS_WEBHOOK_URL || "").trim();
  const key = String(process.env.N8N_WEBHOOK_KEY || "").trim();
  const timeoutMs =
    parsePositiveInteger(process.env.N8N_WEBHOOK_TIMEOUT_MS) || DEFAULT_WEBHOOK_TIMEOUT_MS;

  if (!url) {
    const error = new Error("Sales analysis webhook is not configured");
    error.status = 503;
    throw error;
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported webhook protocol");
    }
  } catch {
    const error = new Error("Sales analysis webhook URL is invalid");
    error.status = 503;
    throw error;
  }

  return { url, key, timeoutMs };
}

async function getRunById(runId) {
  const rows = await query(
    `SELECT ar.*, u.full_name AS requested_by_name
     FROM analysis_runs ar
     LEFT JOIN users u ON u.user_id = ar.requested_by
     WHERE ar.run_id = ?
     LIMIT 1`,
    [runId],
  );

  return rows[0] || null;
}

async function markStaleRunsFailed() {
  const staleMinutes =
    parsePositiveInteger(process.env.ANALYTICS_RUN_STALE_MINUTES) ||
    DEFAULT_STALE_RUN_MINUTES;

  await query(
    `UPDATE analysis_runs
     SET status = 'failed',
         error_message = COALESCE(error_message, 'Analysis run timed out'),
         completed_at = NOW()
     WHERE status IN ('queued', 'running')
       AND created_at < NOW() - (? * INTERVAL '1 minute')`,
    [staleMinutes],
  );
}

async function callAnalysisWebhook({ runId, requestedBy, months }) {
  const { url, key, timeoutMs } = getWebhookConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": `analysis-run-${runId}`,
    };
    if (key) headers["x-webhook-key"] = key;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        run_id: runId,
        requested_by: requestedBy,
        months,
        requested_at: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let responseBody = null;

    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { message: responseText.slice(0, 500) };
      }
    }

    if (!response.ok) {
      const error = new Error(
        responseBody?.message || `n8n webhook returned HTTP ${response.status}`,
      );
      error.status = 502;
      throw error;
    }

    return responseBody;
  } catch (error) {
    if (error.name === "AbortError") {
      // A slow acknowledgement does not mean n8n rejected the job. This commonly
      // happens when the Webhook node responds only after the workflow finishes.
      // Stale-run recovery will handle a request that was never actually accepted.
      return { acknowledgementTimedOut: true };
    }

    if (!error.status) error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

router.get(
  "/latest",
  asyncHandler(async (_req, res) => {
    await markStaleRunsFailed();

    const [runRows, predictions] = await Promise.all([
      query(
        `SELECT ar.*, u.full_name AS requested_by_name
         FROM analysis_runs ar
         LEFT JOIN users u ON u.user_id = ar.requested_by
         ORDER BY ar.created_at DESC, ar.run_id DESC
         LIMIT 1`,
      ),
      query(
        `SELECT sp.*, p.product_name, p.price, p.unit, c.category_name
         FROM sales_prediction sp
         INNER JOIN products p ON p.product_id = sp.product_id
         LEFT JOIN categories c ON c.category_id = p.category_id
         WHERE sp.predicted_month = (
           SELECT MAX(predicted_month) FROM sales_prediction
         )
         ORDER BY sp.product_id`,
      ),
    ]);

    res.json({
      success: true,
      data: {
        run: runRows[0] || null,
        predictions,
      },
    });
  }),
);

router.get(
  "/status/:runId",
  asyncHandler(async (req, res) => {
    const runId = parsePositiveInteger(req.params.runId);
    if (!runId) {
      res.status(400).json({ success: false, message: "Invalid analysis run ID" });
      return;
    }

    await markStaleRunsFailed();
    const run = await getRunById(runId);

    if (!run) {
      res.status(404).json({ success: false, message: "Analysis run not found" });
      return;
    }

    res.json({ success: true, data: run });
  }),
);

router.post(
  "/run",
  asyncHandler(async (req, res) => {
    getWebhookConfig();
    const months = normalizeMonths(req.body?.months);
    await markStaleRunsFailed();

    const activeRows = await query(
      `SELECT ar.*, u.full_name AS requested_by_name
       FROM analysis_runs ar
       LEFT JOIN users u ON u.user_id = ar.requested_by
       WHERE ar.status IN ('queued', 'running')
       ORDER BY ar.created_at DESC, ar.run_id DESC
       LIMIT 1`,
    );

    if (activeRows[0]) {
      res.status(409).json({
        success: false,
        message: "Sales analysis is already running",
        data: activeRows[0],
      });
      return;
    }

    let runId;

    try {
      const result = await query(
        `INSERT INTO analysis_runs (status, requested_by)
         VALUES ('queued', ?)`,
        [req.user.user_id],
      );
      runId = result.insertId;
    } catch (error) {
      if (error.code !== "23505") throw error;

      const rows = await query(
        `SELECT * FROM analysis_runs
         WHERE status IN ('queued', 'running')
         ORDER BY created_at DESC, run_id DESC
         LIMIT 1`,
      );
      res.status(409).json({
        success: false,
        message: "Sales analysis is already running",
        data: rows[0] || null,
      });
      return;
    }

    let webhookAcknowledged;

    try {
      const webhookResponse = await callAnalysisWebhook({
        runId,
        requestedBy: req.user.user_id,
        months,
      });
      webhookAcknowledged = webhookResponse?.acknowledgementTimedOut !== true;
      const executionId =
        webhookResponse?.executionId ||
        webhookResponse?.execution_id ||
        webhookResponse?.data?.executionId ||
        null;

      if (webhookAcknowledged) {
        await query(
          `UPDATE analysis_runs
           SET status = 'running',
               started_at = COALESCE(started_at, NOW()),
               n8n_execution_id = COALESCE(?, n8n_execution_id)
           WHERE run_id = ? AND status = 'queued'`,
          [executionId, runId],
        );
      }
    } catch (error) {
      await query(
        `UPDATE analysis_runs
         SET status = 'failed',
             error_message = ?,
             completed_at = NOW()
         WHERE run_id = ?`,
        [String(error.message || "Unable to start n8n workflow").slice(0, 1000), runId],
      );
      throw error;
    }

    const run = await getRunById(runId);
    res.status(202).json({
      success: true,
      message: webhookAcknowledged
        ? "Sales analysis started"
        : "Sales analysis request dispatched; waiting for n8n confirmation",
      data: run,
      meta: { webhookAcknowledged },
    });
  }),
);

module.exports = router;
