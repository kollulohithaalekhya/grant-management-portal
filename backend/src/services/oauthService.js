const crypto = require('crypto');
const prisma = require('../lib/prisma');
const config = require('../config');
const { ApiError } = require('../utils/errors');
const { ROLES } = require('../constants/roles');
const { saveOAuthState, consumeOAuthState } = require('../lib/redis');
const userService = require('./userService');
const authService = require('./authService');

const google = config.oauth.google;

const assertConfigured = () => {
  if (!google.enabled) {
    throw new ApiError(
      'Google OAuth is not configured. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET.',
      503
    );
  }
};

/**
 * Step 1 — build the Google consent URL.
 *
 * A random `state` is stored server-side (Redis) and echoed back by Google on
 * the callback; a mismatch means the callback did not originate from a login
 * this server started (CSRF).
 */
const buildAuthorizationUrl = async ({ redirectTo } = {}) => {
  assertConfigured();

  const state = crypto.randomBytes(32).toString('hex');
  await saveOAuthState(state, { redirectTo: redirectTo || null, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: 'code',
    scope: google.scope,
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return { url: `${google.authorizationEndpoint}?${params.toString()}`, state };
};

/** Step 2a — exchange the one-time authorization code for Google tokens. */
const exchangeCodeForTokens = async (code) => {
  const response = await fetch(google.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: google.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw ApiError.unauthorized(
      `Failed to exchange authorization code${payload.error ? `: ${payload.error}` : ''}`
    );
  }
  return payload;
};

/** Step 2b — read the profile behind the freshly issued Google access token. */
const fetchGoogleProfile = async (accessToken) => {
  const response = await fetch(google.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profile = await response.json().catch(() => ({}));
  if (!response.ok || !profile.sub || !profile.email) {
    throw ApiError.unauthorized('Failed to fetch Google profile');
  }
  return profile;
};

/**
 * Step 3 — map the Google identity onto a local user.
 *
 * Matching order: known provider id, then verified email (links Google to an
 * existing password account), otherwise a new APPLICANT account is created.
 */
const findOrCreateUser = async (profile) => {
  const email = profile.email.toLowerCase();

  const byProvider = await prisma.user.findUnique({
    where: { providerId: profile.sub },
    include: userService.withRoles,
  });

  if (byProvider) {
    if (!byProvider.isActive) throw ApiError.forbidden('Account is deactivated');
    return prisma.user.update({
      where: { id: byProvider.id },
      data: { name: profile.name || byProvider.name, avatar: profile.picture || byProvider.avatar },
      include: userService.withRoles,
    });
  }

  const byEmail = await userService.findByEmail(email);
  if (byEmail) {
    if (!byEmail.isActive) throw ApiError.forbidden('Account is deactivated');
    // Only link when Google asserts the address is verified — otherwise an
    // unverified Google account could take over a local one.
    if (profile.email_verified === false) {
      throw ApiError.forbidden('Google account email is not verified');
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { providerId: profile.sub, avatar: byEmail.avatar || profile.picture || null },
      include: userService.withRoles,
    });
  }

  return userService.createUser({
    name: profile.name || email.split('@')[0],
    email,
    password: null,
    provider: 'GOOGLE',
    providerId: profile.sub,
    avatar: profile.picture || null,
    roles: [ROLES.APPLICANT],
  });
};

/**
 * Full callback handling: validate state, exchange the code, load the profile,
 * resolve the local user and issue the portal's own JWT pair.
 */
const handleCallback = async ({ code, state }) => {
  assertConfigured();
  if (!code) throw ApiError.badRequest('Authorization code is required');
  if (!state) throw ApiError.badRequest('State parameter is required');

  const stored = await consumeOAuthState(state);
  if (!stored) throw ApiError.unauthorized('Invalid or expired OAuth state');

  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchGoogleProfile(tokens.access_token);
  const user = await findOrCreateUser(profile);
  const session = await authService.issueSession(user);

  return { ...session, redirectTo: stored.redirectTo || null };
};

module.exports = { buildAuthorizationUrl, handleCallback };
