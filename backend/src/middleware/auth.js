const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { serializeUser } = require('../lib/serializers');
const { isAccessTokenRevoked } = require('../lib/redis');
const prisma = require('../lib/prisma');
const { ROLES, ALL_ROLES } = require('../constants/roles');

/** True when `user` holds at least one of `roles`. */
const hasAnyRole = (user, roles) =>
  Boolean(user) && Array.isArray(user.roles) && user.roles.some((role) => roles.includes(role));

/**
 * Verifies the bearer access token, rejects revoked tokens, then reloads the
 * user (with roles) so a role change or deactivation takes effect immediately
 * instead of waiting for the token to expire.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = verifyAccessToken(token);

    if (decoded.jti && (await isAccessTokenRevoked(decoded.jti))) {
      return sendError(res, 'Token has been revoked', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive', 401);
    }

    req.user = serializeUser(user);
    req.tokenPayload = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return sendError(res, 'Invalid token', 401);
    }
    return next(err);
  }
};

/**
 * RBAC guard. Passes when the authenticated user holds any of the listed
 * roles — a user with several concurrent roles only needs one match.
 */
const authorize = (...roles) => {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }
    if (!hasAnyRole(req.user, allowed)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    return next();
  };
};

/**
 * Decodes a bearer access token when one is present but never rejects the
 * request. Logout uses it so a still-valid access token can be denylisted,
 * while an already-expired token still logs the session out cleanly.
 */
const attachTokenPayload = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.tokenPayload = verifyAccessToken(authHeader.slice('Bearer '.length).trim());
    } catch {
      req.tokenPayload = null;
    }
  }
  return next();
};

module.exports = {
  authenticate,
  authorize,
  attachTokenPayload,
  hasAnyRole,
  ROLES,
  ALL_ROLES,
};
