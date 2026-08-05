const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, prisma, resetData, createUser, createUserAndLogin, uniqueEmail, ROLES } = require('./helpers/factories');

beforeEach(resetData);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates an APPLICANT account and returns a token pair', async () => {
    const email = uniqueEmail('newbie');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Person', email, password: 'Str0ngPass' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email, roles: [ROLES.APPLICANT] });
    expect(res.body.data.user.password).toBeUndefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');

    const stored = await prisma.refreshToken.findUnique({
      where: { token: res.body.data.refreshToken },
    });
    expect(stored).not.toBeNull();
  });

  it('persists the role assignment in the user_roles join table', async () => {
    const email = uniqueEmail('joined');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Joined', email, password: 'Str0ngPass' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    expect(user.roles.map((r) => r.role.name)).toEqual([ROLES.APPLICANT]);
  });

  it('rejects a weak password with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: uniqueEmail('weak'), password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects a malformed email with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password: 'Str0ngPass' });

    expect(res.status).toBe(422);
  });

  it('rejects a duplicate email with 409', async () => {
    const existing = await createUser({ email: uniqueEmail('dupe') });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Copy', email: existing.email, password: 'Str0ngPass' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const user = await createUser({ email: uniqueEmail('login') });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('rejects a wrong password with 401', async () => {
    const user = await createUser({ email: uniqueEmail('wrongpw') });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Nope@12345' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Whatever@123' });

    expect(res.status).toBe(401);
  });

  it('rejects a deactivated account with 403', async () => {
    const user = await createUser({ email: uniqueEmail('inactive'), isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.plainPassword });

    expect(res.status).toBe(403);
  });

  it('requires a password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(422);
  });
});

describe('JWT payload', () => {
  it('carries the id and every role the user holds', async () => {
    const session = await createUserAndLogin({
      email: uniqueEmail('multirole'),
      roles: [ROLES.ADMIN, ROLES.GRANT_MANAGER],
    });

    const decoded = jwt.decode(session.accessToken);
    expect(decoded.id).toBe(session.user.id);
    expect(decoded.roles.sort()).toEqual([ROLES.ADMIN, ROLES.GRANT_MANAGER]);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and issues a new pair', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('refresh') });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(session.refreshToken);
    expect(res.body.data.user.id).toBe(session.user.id);

    const old = await prisma.refreshToken.findUnique({ where: { token: session.refreshToken } });
    expect(old.revokedAt).not.toBeNull();
  });

  it('refuses to reuse an already rotated refresh token', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('reuse') });
    await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(401);
  });

  it('requires a refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(422);
  });

  it('rejects an unknown refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not.a.real.token' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('me') });
    const res = await request(app).get('/api/auth/me').set('Authorization', session.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(session.user.id);
    expect(res.body.data.user.roles).toEqual([ROLES.APPLICANT]);
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret with 401', async () => {
    const forged = jwt.sign({ id: 'x', roles: ['ADMIN'] }, 'attacker-secret', { expiresIn: '1h' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token whose user was deactivated after issuance', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('deact') });
    await prisma.user.update({ where: { id: session.user.id }, data: { isActive: false } });

    const res = await request(app).get('/api/auth/me').set('Authorization', session.authHeader);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and denylists the access token', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('logout') });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', session.authHeader)
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(200);

    const meRes = await request(app).get('/api/auth/me').set('Authorization', session.authHeader);
    expect(meRes.status).toBe(401);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('succeeds without any token', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('GET /health', () => {
  it('reports the database as reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});

describe('unknown routes', () => {
  it('returns 404 with a helpful message', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
