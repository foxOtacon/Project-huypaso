const { signToken, verifyToken } = require("../utils/jwt");
const { query } = require("../config/db");
const { sanitizeUser } = require("../utils/userHelper");
const asyncHandler = require("../utils/asyncHandler");

function logAuthFailure(req, reason, details = {}) {
  console.warn("[AUTH]", {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    reason,
    ...details,
  });
}

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logAuthFailure(req, "MISSING_BEARER_TOKEN");
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    const expired = error?.name === "TokenExpiredError";
    const code = expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    logAuthFailure(req, code, expired ? { expiredAt: error.expiredAt?.toISOString?.() } : {});
    res.status(401).json({
      success: false,
      code,
      message: expired ? "Token expired" : "Invalid token",
    });
    return;
  }

  const tokenUserId = payload.user_id == null ? '' : String(payload.user_id);
  const tokenEmail = String(payload.email || '').trim().toLowerCase();
  const rows = await query(
    `SELECT * FROM users
     WHERE CAST(user_id AS TEXT) = ? OR LOWER(TRIM(email)) = ?
     ORDER BY CASE WHEN CAST(user_id AS TEXT) = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [tokenUserId, tokenEmail, tokenUserId],
  );
  const recoveredByEmail =
    rows.length > 0 && String(rows[0].user_id) !== tokenUserId;

  if (rows.length === 0) {
    logAuthFailure(req, "SESSION_ACCOUNT_NOT_FOUND", {
      tokenUserId: payload.user_id == null ? null : String(payload.user_id),
      hasEmailClaim: Boolean(payload.email),
    });
    res.status(401).json({
      success: false,
      code: "SESSION_INVALID",
      message: "Session no longer matches this account",
    });
    return;
  }

  if (rows[0].status === "suspended") {
    logAuthFailure(req, "ACCOUNT_SUSPENDED", { userId: String(rows[0].user_id) });
    res.status(403).json({
      success: false,
      code: "ACCOUNT_SUSPENDED",
      message: "Account is suspended",
    });
    return;
  }

  req.user = sanitizeUser(rows[0]);
  req.tokenPayload = payload;
  req.sessionNeedsRefresh =
    recoveredByEmail ||
    String(payload.user_id) !== String(req.user.user_id) ||
    String(payload.email || '').trim().toLowerCase() !== String(req.user.email || '').trim().toLowerCase() ||
    payload.role !== req.user.role;
  if (req.sessionNeedsRefresh) {
    console.info("[AUTH]", {
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      reason: "SESSION_REFRESHED",
      userId: String(req.user.user_id),
    });
  }
  next();
});

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    next();
  };
}

const getMe = asyncHandler(async (req, res) => {
  const token = req.sessionNeedsRefresh
    ? signToken({
        user_id: req.user.user_id,
        email: req.user.email,
        role: req.user.role,
      })
    : null;

  res.json({
    success: true,
    data: req.user,
    ...(token ? { token } : {}),
  });
});

module.exports = { authenticate, authorize, getMe };
