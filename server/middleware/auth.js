const { verifyToken } = require("../utils/jwt");
const { query } = require("../config/db");
const { sanitizeUser } = require("../utils/userHelper");
const asyncHandler = require("../utils/asyncHandler");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

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
  const rows = await query("SELECT * FROM users WHERE user_id = ?", [req.user.user_id]);

  if (rows.length === 0) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  res.json({ success: true, data: sanitizeUser(rows[0]) });
});

module.exports = { authenticate, authorize, getMe };
