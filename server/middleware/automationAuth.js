const crypto = require("crypto");

function automationAuth(req, res, next) {
  const configuredKey = String(process.env.N8N_API_KEY || "");
  const suppliedKey = String(req.headers["x-automation-key"] || "");
  if (!configuredKey || !suppliedKey) {
    res.status(401).json({ success: false, message: "Automation key is required" });
    return;
  }
  const expected = Buffer.from(configuredKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    res.status(401).json({ success: false, message: "Invalid automation key" });
    return;
  }
  next();
}

module.exports = automationAuth;
