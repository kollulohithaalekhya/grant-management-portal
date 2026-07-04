const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const db = require('../db');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await db.users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return sendError(res, 'Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const user = await db.users.insert({
      _id: uuidv4(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'APPLICANT', // default role
      provider: 'local',
      avatar: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const { password: _, ...safeUser } = user;
    const tokens = generateTokenPair(user);

    // Store refresh token
    await db.refreshTokens.insert({
      _id: uuidv4(),
      token: tokens.refreshToken,
      userId: user._id,
      createdAt: now,
    });

    return sendSuccess(res, { user: safeUser, ...tokens }, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db.users.findOne({ email: email.toLowerCase() });
    if (!user || user.provider !== 'local') {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const { password: _, ...safeUser } = user;
    const tokens = generateTokenPair(user);

    // Store refresh token
    await db.refreshTokens.insert({
      _id: uuidv4(),
      token: tokens.refreshToken,
      userId: user._id,
      createdAt: new Date().toISOString(),
    });

    return sendSuccess(res, { user: safeUser, ...tokens }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 'Refresh token required', 400);

    // Check DB
    const stored = await db.refreshTokens.findOne({ token: refreshToken });
    if (!stored) return sendError(res, 'Invalid refresh token', 401);

    const decoded = verifyRefreshToken(refreshToken);
    const user = await db.users.findOne({ _id: decoded.id });
    if (!user || !user.isActive) return sendError(res, 'User not found', 401);

    // Rotate: delete old, issue new
    await db.refreshTokens.remove({ token: refreshToken });

    const tokens = generateTokenPair(user);
    await db.refreshTokens.insert({
      _id: uuidv4(),
      token: tokens.refreshToken,
      userId: user._id,
      createdAt: new Date().toISOString(),
    });

    const { password: _, ...safeUser } = user;
    return sendSuccess(res, { user: safeUser, ...tokens }, 'Token refreshed');
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.refreshTokens.remove({ token: refreshToken });
    }
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  return sendSuccess(res, { user: req.user });
};

module.exports = { register, login, refresh, logout, me };
