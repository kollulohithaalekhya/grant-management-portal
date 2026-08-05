const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const config = require('../config');
const { ApiError } = require('../utils/errors');
const { ROLES } = require('../constants/roles');
const { generateTokenPair, verifyRefreshToken, getTokenExpiry } = require('../utils/jwt');
const { revokeAccessToken } = require('../lib/redis');
const { serializeUser } = require('../lib/serializers');
const userService = require('./userService');

/** Persists a freshly minted refresh token so it can be rotated and revoked. */
const storeRefreshToken = (token, userId, client = prisma) =>
  client.refreshToken.create({
    data: { token, userId, expiresAt: getTokenExpiry(token) },
  });

const issueSession = async (user, client = prisma) => {
  const tokens = generateTokenPair(user);
  await storeRefreshToken(tokens.refreshToken, user.id, client);
  return { user: serializeUser(user), ...tokens };
};

const register = async ({ name, email, password }) => {
  const existing = await userService.findByEmail(email);
  if (existing) throw ApiError.conflict('Email already registered');

  const hashed = await bcrypt.hash(password, config.bcryptRounds);

  // User row, role assignment and refresh token are written together: a
  // half-registered account with no roles would be unusable.
  return prisma.$transaction(async (tx) => {
    const user = await userService.createUser(
      { name, email, password: hashed, roles: [ROLES.APPLICANT] },
      tx
    );
    return issueSession(user, tx);
  });
};

const login = async ({ email, password }) => {
  const user = await userService.findByEmail(email);
  // Accounts created through Google have no password hash and cannot log in
  // with credentials; they are indistinguishable from "no such user" here.
  if (!user || !user.password) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  return issueSession(user);
};

/**
 * Rotates a refresh token: the presented token is revoked and a new pair is
 * issued in the same transaction, so a crash cannot leave both live.
 */
const refresh = async (refreshToken) => {
  if (!refreshToken) throw ApiError.badRequest('Refresh token required');

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revokedAt) throw ApiError.unauthorized('Invalid refresh token');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await userService.findById(decoded.id);
  if (!user || !user.isActive) throw ApiError.unauthorized('User not found or inactive');

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
    return issueSession(user, tx);
  });
};

/**
 * Revokes the presented refresh token and, when an access token was sent,
 * adds its `jti` to the denylist so the remaining minutes cannot be used.
 */
const logout = async ({ refreshToken, tokenPayload }) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (tokenPayload && tokenPayload.jti && tokenPayload.exp) {
    const ttl = tokenPayload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await revokeAccessToken(tokenPayload.jti, ttl);
  }
};

module.exports = { register, login, refresh, logout, issueSession };
