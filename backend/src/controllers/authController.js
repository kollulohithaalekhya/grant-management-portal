const config = require('../config');
const authService = require('../services/authService');
const oauthService = require('../services/oauthService');
const { sendSuccess } = require('../utils/response');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const session = await authService.register(req.body);
    return sendSuccess(res, session, 'Registration successful', 201);
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const session = await authService.login(req.body);
    return sendSuccess(res, session, 'Login successful');
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const session = await authService.refresh(req.body.refreshToken);
    return sendSuccess(res, session, 'Token refreshed');
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await authService.logout({
      refreshToken: req.body.refreshToken,
      tokenPayload: req.tokenPayload,
    });
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    return next(err);
  }
};

// GET /api/auth/me
const me = async (req, res) => sendSuccess(res, { user: req.user });

// GET /api/auth/google — start the Google OAuth 2.0 authorization code flow
const googleRedirect = async (req, res, next) => {
  try {
    const { url } = await oauthService.buildAuthorizationUrl({ redirectTo: req.query.redirectTo });
    return res.redirect(url);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/google/callback — Google redirects the browser here.
 *
 * Tokens travel back to the SPA in the URL fragment: fragments are not sent to
 * servers and are kept out of proxy/access logs and the Referer header.
 */
const googleCallback = async (req, res, next) => {
  const failureRedirect = (message) =>
    res.redirect(`${config.clientUrl}/oauth/callback#error=${encodeURIComponent(message)}`);

  try {
    if (req.query.error) {
      return failureRedirect(String(req.query.error));
    }

    const session = await oauthService.handleCallback({
      code: req.query.code,
      state: req.query.state,
    });

    const fragment = new URLSearchParams({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (session.redirectTo) fragment.set('redirectTo', session.redirectTo);

    return res.redirect(`${config.clientUrl}/oauth/callback#${fragment.toString()}`);
  } catch (err) {
    if (err.name === 'ApiError') {
      return failureRedirect(err.message);
    }
    return next(err);
  }
};

module.exports = { register, login, refresh, logout, me, googleRedirect, googleCallback };
