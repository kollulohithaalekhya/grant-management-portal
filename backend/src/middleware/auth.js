const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const db = require('../db');

// Verify JWT access token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch fresh user from DB
    const user = await db.users.findOne({ _id: decoded.id });
    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive', 401);
    }

    // Attach user to request (exclude password)
    const { password, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    return sendError(res, 'Invalid token', 401);
  }
};

// Role-Based Access Control middleware factory
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

// Roles constants
const ROLES = {
  ADMIN: 'ADMIN',
  GRANT_MANAGER: 'GRANT_MANAGER',
  APPLICANT: 'APPLICANT',
};

module.exports = { authenticate, authorize, ROLES };
