const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { roleNames } = require('../lib/serializers');

const generateAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpiresIn });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

/**
 * Builds the access/refresh pair for a user record loaded with its roles.
 *
 * The access token carries every role the user currently holds:
 *   { id, email, name, roles: ["ADMIN", "GRANT_MANAGER"], jti }
 * `jti` lets logout revoke a still-valid access token via the Redis denylist.
 */
const generateTokenPair = (user) => {
  const roles = roleNames(user);
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    roles,
    jti: crypto.randomUUID(),
  });
  const refreshToken = generateRefreshToken({
    id: user.id,
    roles,
    jti: crypto.randomUUID(),
    type: 'refresh',
  });
  return { accessToken, refreshToken };
};

/** Expiry of a signed token as a Date, used to persist refresh-token rows. */
const getTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  return decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date();
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  getTokenExpiry,
};
