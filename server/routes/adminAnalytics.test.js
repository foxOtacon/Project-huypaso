const { after, test } = require("node:test");
const assert = require("node:assert/strict");

const analyticsRouter = require("./adminAnalytics");

const {
  getWebhookConfig,
  getWebhookOutcome,
  parseSavedCount,
} = analyticsRouter.__test;

const originalEnvironment = {
  url: process.env.N8N_SALES_ANALYSIS_WEBHOOK_URL,
  timeout: process.env.N8N_WEBHOOK_TIMEOUT_MS,
};

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

after(() => {
  restoreEnvironment(
    "N8N_SALES_ANALYSIS_WEBHOOK_URL",
    originalEnvironment.url,
  );
  restoreEnvironment("N8N_WEBHOOK_TIMEOUT_MS", originalEnvironment.timeout);
});

test("parseSavedCount accepts only non-negative integers", () => {
  assert.equal(parseSavedCount(2), 2);
  assert.equal(parseSavedCount("3"), 3);
  assert.equal(parseSavedCount(-1), null);
  assert.equal(parseSavedCount("2.5"), null);
  assert.equal(parseSavedCount(undefined), null);
});

test("synchronous webhook responses complete the analysis run", () => {
  assert.deepEqual(
    getWebhookOutcome({ success: true, saved_count: 2 }),
    { mode: "completed", resultCount: 2 },
  );
  assert.deepEqual(
    getWebhookOutcome({ success: true, data: { savedCount: "4" } }),
    { mode: "completed", resultCount: 4 },
  );
  assert.deepEqual(
    getWebhookOutcome({ success: true, predictions: [{}, {}] }),
    { mode: "completed", resultCount: 2 },
  );
});

test("immediate webhook acknowledgement remains asynchronous", () => {
  assert.deepEqual(
    getWebhookOutcome({ message: "Workflow was started" }),
    { mode: "accepted", resultCount: null },
  );
});

test("a logical n8n failure is rejected even when HTTP succeeded", () => {
  assert.throws(
    () => getWebhookOutcome({ success: false, message: "AI failed" }),
    (error) => error.status === 502 && error.message === "AI failed",
  );
});

test("legacy five-second configuration is clamped for synchronous n8n", () => {
  process.env.N8N_SALES_ANALYSIS_WEBHOOK_URL = "https://n8n.example/webhook/test";
  process.env.N8N_WEBHOOK_TIMEOUT_MS = "5000";
  assert.equal(getWebhookConfig().timeoutMs, 45000);

  process.env.N8N_WEBHOOK_TIMEOUT_MS = "60000";
  assert.equal(getWebhookConfig().timeoutMs, 60000);
});
