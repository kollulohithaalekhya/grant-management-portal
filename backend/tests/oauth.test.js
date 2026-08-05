const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  app,
  prisma,
  resetData,
  createUser,
  uniqueEmail,
  ROLES,
} = require('./helpers/factories');

/**
 * Google is mocked at the `fetch` boundary: the routes, state handling, code
 * exchange, profile lookup and local user resolution are all real.
 */
const GOOGLE_PROFILE = {
  sub: '1078311423540987654321',
  email: 'oauth.person@gmail.com',
  email_verified: true,
  name: 'OAuth Person',
  picture: 'https://lh3.googleusercontent.com/a/photo',
};

const mockGoogle = ({ profile = GOOGLE_PROFILE, tokenOk = true, profileOk = true } = {}) => {
  const calls = [];
  global.fetch = jest.fn(async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('oauth2.googleapis.com/token')) {
      return tokenOk
        ? { ok: true, json: async () => ({ access_token: 'google-access-token', expires_in: 3599 }) }
        : { ok: false, json: async () => ({ error: 'invalid_grant' }) };
    }

    if (String(url).includes('userinfo')) {
      return profileOk
        ? { ok: true, json: async () => profile }
        : { ok: false, json: async () => ({ error: 'invalid_token' }) };
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });
  return calls;
};

/** Runs the redirect step and returns the `state` Google would echo back. */
const startFlow = async () => {
  const res = await request(app).get('/api/auth/google');
  expect(res.status).toBe(302);
  const location = new URL(res.headers.location);
  return { location, state: location.searchParams.get('state') };
};

const fragmentOf = (location) => new URLSearchParams(new URL(location).hash.replace(/^#/, ''));

const originalFetch = global.fetch;

beforeEach(resetData);
afterEach(() => {
  global.fetch = originalFetch;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/auth/google', () => {
  it('redirects to Google with the configured client and a state nonce', async () => {
    const { location, state } = await startFlow();

    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
    expect(location.searchParams.get('client_id')).toBe(process.env.OAUTH_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(process.env.OAUTH_REDIRECT_URI);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toContain('email');
    expect(state).toHaveLength(64);
  });

  it('issues a different state for each attempt', async () => {
    const first = await startFlow();
    const second = await startFlow();
    expect(first.state).not.toBe(second.state);
  });
});

describe('GET /api/auth/google/callback', () => {
  it('exchanges the code, creates a local user and returns portal tokens', async () => {
    const calls = mockGoogle();
    const { state } = await startFlow();

    const res = await request(app).get(`/api/auth/google/callback?code=auth-code-123&state=${state}`);

    expect(res.status).toBe(302);

    // The authorization code was exchanged with the right credentials.
    const tokenCall = calls.find((c) => c.url.includes('/token'));
    const body = new URLSearchParams(tokenCall.options.body);
    expect(body.get('code')).toBe('auth-code-123');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe(process.env.OAUTH_CLIENT_SECRET);

    // The profile was fetched with the Google access token.
    const profileCall = calls.find((c) => c.url.includes('userinfo'));
    expect(profileCall.options.headers.Authorization).toBe('Bearer google-access-token');

    // A local user now exists, with the default role.
    const user = await prisma.user.findUnique({
      where: { email: GOOGLE_PROFILE.email },
      include: { roles: { include: { role: true } } },
    });
    expect(user.provider).toBe('GOOGLE');
    expect(user.providerId).toBe(GOOGLE_PROFILE.sub);
    expect(user.password).toBeNull();
    expect(user.roles.map((r) => r.role.name)).toEqual([ROLES.APPLICANT]);

    // Portal tokens came back in the fragment and actually work.
    const fragment = fragmentOf(res.headers.location);
    expect(res.headers.location.startsWith(`${process.env.CLIENT_URL}/oauth/callback#`)).toBe(true);
    expect(jwt.decode(fragment.get('accessToken')).roles).toEqual([ROLES.APPLICANT]);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fragment.get('accessToken')}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(GOOGLE_PROFILE.email);

    const stored = await prisma.refreshToken.findUnique({
      where: { token: fragment.get('refreshToken') },
    });
    expect(stored).not.toBeNull();
  });

  it('reuses the same account on a second login', async () => {
    mockGoogle();
    const first = await startFlow();
    await request(app).get(`/api/auth/google/callback?code=code-1&state=${first.state}`);

    mockGoogle();
    const second = await startFlow();
    await request(app).get(`/api/auth/google/callback?code=code-2&state=${second.state}`);

    expect(await prisma.user.count()).toBe(1);
  });

  it('links a verified Google identity to an existing password account', async () => {
    const local = await createUser({ email: uniqueEmail('linked'), roles: [ROLES.GRANT_MANAGER] });
    mockGoogle({ profile: { ...GOOGLE_PROFILE, email: local.email } });

    const { state } = await startFlow();
    const res = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);

    const fragment = fragmentOf(res.headers.location);
    expect(jwt.decode(fragment.get('accessToken')).id).toBe(local.id);
    expect(jwt.decode(fragment.get('accessToken')).roles).toEqual([ROLES.GRANT_MANAGER]);
    expect(await prisma.user.count()).toBe(1);

    // Password login still works after linking.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: local.email, password: local.plainPassword });
    expect(login.status).toBe(200);
  });

  it('refuses to link when Google reports the email as unverified', async () => {
    const local = await createUser({ email: uniqueEmail('unverified') });
    mockGoogle({ profile: { ...GOOGLE_PROFILE, email: local.email, email_verified: false } });

    const { state } = await startFlow();
    const res = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);

    expect(fragmentOf(res.headers.location).get('error')).toMatch(/not verified/i);
  });

  it('rejects a deactivated account', async () => {
    const local = await createUser({ email: uniqueEmail('off'), isActive: false });
    mockGoogle({ profile: { ...GOOGLE_PROFILE, email: local.email } });

    const { state } = await startFlow();
    const res = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);

    expect(fragmentOf(res.headers.location).get('error')).toMatch(/deactivated/i);
  });

  it('rejects an unknown state (CSRF protection)', async () => {
    mockGoogle();
    const res = await request(app).get('/api/auth/google/callback?code=code&state=forged-state');

    expect(fragmentOf(res.headers.location).get('error')).toMatch(/state/i);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects a replayed state — each one is single use', async () => {
    mockGoogle();
    const { state } = await startFlow();
    await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);

    mockGoogle();
    const replay = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);
    expect(fragmentOf(replay.headers.location).get('error')).toMatch(/state/i);
  });

  it('reports a failed code exchange', async () => {
    mockGoogle({ tokenOk: false });
    const { state } = await startFlow();

    const res = await request(app).get(`/api/auth/google/callback?code=bad&state=${state}`);
    expect(fragmentOf(res.headers.location).get('error')).toMatch(/exchange/i);
    expect(await prisma.user.count()).toBe(0);
  });

  it('reports a failed profile lookup', async () => {
    mockGoogle({ profileOk: false });
    const { state } = await startFlow();

    const res = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);
    expect(fragmentOf(res.headers.location).get('error')).toMatch(/profile/i);
  });

  it('passes a Google-side error straight through', async () => {
    const res = await request(app).get('/api/auth/google/callback?error=access_denied');
    expect(fragmentOf(res.headers.location).get('error')).toBe('access_denied');
  });

  it('rejects a callback with no code', async () => {
    const { state } = await startFlow();
    const res = await request(app).get(`/api/auth/google/callback?state=${state}`);
    expect(fragmentOf(res.headers.location).get('error')).toMatch(/code/i);
  });

  it('preserves the requested post-login destination', async () => {
    mockGoogle();
    const start = await request(app).get('/api/auth/google?redirectTo=/grants/new');
    const state = new URL(start.headers.location).searchParams.get('state');

    const res = await request(app).get(`/api/auth/google/callback?code=code&state=${state}`);
    expect(fragmentOf(res.headers.location).get('redirectTo')).toBe('/grants/new');
  });
});
