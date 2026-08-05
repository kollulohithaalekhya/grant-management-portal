const Redis = require('ioredis');
const config = require('../config');

/**
 * Small key/value store used for short-lived security state:
 *   - `oauth:state:<state>` — CSRF nonce for the Google OAuth handshake
 *   - `denylist:<jti>`      — access tokens revoked by an explicit logout
 *
 * Backed by Redis when REDIS_URL is configured. When it is not (local runs
 * without Docker, and the test suite) an equivalent in-process store with the
 * same TTL semantics is used, so no call site needs to branch.
 */

class MemoryStore {
  constructor() {
    this.map = new Map();
  }

  #alive(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry;
  }

  async get(key) {
    const entry = this.#alive(key);
    return entry ? entry.value : null;
  }

  async set(key, value, ttlSeconds) {
    this.map.set(key, {
      value: String(value),
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
    return 'OK';
  }

  async del(key) {
    return this.map.delete(key) ? 1 : 0;
  }

  async quit() {
    this.map.clear();
  }
}

class RedisStore {
  constructor(url) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });
  }

  get(key) {
    return this.client.get(key);
  }

  set(key, value, ttlSeconds) {
    if (ttlSeconds > 0) return this.client.set(key, String(value), 'EX', ttlSeconds);
    return this.client.set(key, String(value));
  }

  del(key) {
    return this.client.del(key);
  }

  quit() {
    return this.client.quit();
  }
}

const store = config.redisUrl ? new RedisStore(config.redisUrl) : new MemoryStore();

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const saveOAuthState = (state, payload) =>
  store.set(`oauth:state:${state}`, JSON.stringify(payload), OAUTH_STATE_TTL_SECONDS);

/** Reads and immediately consumes an OAuth state token (single use). */
const consumeOAuthState = async (state) => {
  const key = `oauth:state:${state}`;
  const raw = await store.get(key);
  if (!raw) return null;
  await store.del(key);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const revokeAccessToken = (jti, ttlSeconds) =>
  store.set(`denylist:${jti}`, '1', Math.max(ttlSeconds, 1));

const isAccessTokenRevoked = async (jti) => Boolean(await store.get(`denylist:${jti}`));

module.exports = {
  store,
  saveOAuthState,
  consumeOAuthState,
  revokeAccessToken,
  isAccessTokenRevoked,
  usingRedis: Boolean(config.redisUrl),
};
