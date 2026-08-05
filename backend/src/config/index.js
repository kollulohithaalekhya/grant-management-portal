require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

/**
 * Fails fast on a missing secret instead of signing tokens with `undefined`,
 * which jsonwebtoken would otherwise accept for HS256 with an empty key.
 */
const required = (name, fallback) => {
  const value = process.env[name];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
};

const config = {
  env: process.env.NODE_ENV || 'development',
  isTest,
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || null,
  jwt: {
    accessSecret: required('JWT_SECRET', isTest ? 'test-access-secret' : undefined),
    refreshSecret: required('JWT_REFRESH_SECRET', isTest ? 'test-refresh-secret' : undefined),
    accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  oauth: {
    google: {
      clientId: process.env.OAUTH_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
      redirectUri:
        process.env.OAUTH_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile',
    },
  },
  bcryptRounds: isTest ? 4 : 12,
};

config.oauth.google.enabled = Boolean(
  config.oauth.google.clientId && config.oauth.google.clientSecret
);

module.exports = config;
