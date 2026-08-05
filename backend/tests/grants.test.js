const request = require('supertest');
const {
  app,
  prisma,
  resetData,
  createUser,
  createUserAndLogin,
  createGrant,
  createApplication,
  uniqueEmail,
  ROLES,
} = require('./helpers/factories');

const validGrantPayload = (overrides = {}) => ({
  title: 'Clean Water Initiative',
  description: 'Funding to improve access to clean drinking water.',
  amount: 25000,
  deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  category: 'Environment',
  eligibility: 'Registered non-profits.',
  ...overrides,
});

let admin;
let manager;
let otherManager;
let applicant;

beforeEach(async () => {
  await resetData();
  admin = await createUserAndLogin({ email: uniqueEmail('admin'), roles: [ROLES.ADMIN] });
  manager = await createUserAndLogin({ email: uniqueEmail('mgr'), roles: [ROLES.GRANT_MANAGER] });
  otherManager = await createUserAndLogin({
    email: uniqueEmail('mgr2'),
    roles: [ROLES.GRANT_MANAGER],
  });
  applicant = await createUserAndLogin({ email: uniqueEmail('app') });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/grants', () => {
  it('lets a grant manager create a grant', async () => {
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', manager.authHeader)
      .send(validGrantPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Clean Water Initiative');
    expect(res.body.data.amount).toBe(25000);
    expect(res.body.data.createdById).toBe(manager.user.id);
  });

  it('refuses an applicant with 403', async () => {
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', applicant.authHeader)
      .send(validGrantPayload());

    expect(res.status).toBe(403);
  });

  it.each([
    ['missing title', { title: '' }],
    ['non-numeric amount', { amount: 'lots' }],
    ['negative amount', { amount: -5 }],
    ['invalid deadline', { deadline: 'next tuesday' }],
    ['missing category', { category: '' }],
    ['invalid status', { status: 'PAUSED' }],
  ])('rejects %s with 422', async (_label, override) => {
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', manager.authHeader)
      .send(validGrantPayload(override));

    expect(res.status).toBe(422);
  });
});

describe('GET /api/grants', () => {
  it('returns a paginated list for managers', async () => {
    await createGrant(manager.user.id, { title: 'One' });
    await createGrant(manager.user.id, { title: 'Two' });

    const res = await request(app)
      .get('/api/grants?page=1&limit=1')
      .set('Authorization', manager.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(res.body.data[0].createdByName).toBe(manager.user.name);
  });

  it('hides non-open grants from applicants', async () => {
    await createGrant(manager.user.id, { title: 'Open one' });
    await createGrant(manager.user.id, { title: 'Closed one', status: 'CLOSED' });

    const res = await request(app).get('/api/grants').set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Open one');
  });

  it('filters by search term', async () => {
    await createGrant(manager.user.id, { title: 'Solar panels for schools' });
    await createGrant(manager.user.id, { title: 'Library refurbishment' });

    const res = await request(app)
      .get('/api/grants?search=solar')
      .set('Authorization', manager.authHeader);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toMatch(/Solar/);
  });

  it('filters by category and status', async () => {
    await createGrant(manager.user.id, { category: 'Health', status: 'CLOSED' });
    await createGrant(manager.user.id, { category: 'Education' });

    const res = await request(app)
      .get('/api/grants?category=Health&status=CLOSED')
      .set('Authorization', admin.authHeader);

    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/grants/:id', () => {
  it('returns the grant with its application count', async () => {
    const grant = await createGrant(manager.user.id);
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .get(`/api/grants/${grant.id}`)
      .set('Authorization', manager.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.applicationCount).toBe(1);
  });

  it('404s for an unknown id', async () => {
    const res = await request(app)
      .get('/api/grants/11111111-1111-4111-8111-111111111111')
      .set('Authorization', manager.authHeader);

    expect(res.status).toBe(404);
  });

  it('422s for a malformed id', async () => {
    const res = await request(app)
      .get('/api/grants/not-a-uuid')
      .set('Authorization', manager.authHeader);

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/grants/:id', () => {
  it('runs validation middleware before the controller', async () => {
    const grant = await createGrant(manager.user.id);

    const res = await request(app)
      .put(`/api/grants/${grant.id}`)
      .set('Authorization', manager.authHeader)
      .send({ amount: 'not-a-number' });

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.path === 'amount')).toBe(true);

    // The controller must not have run.
    const unchanged = await prisma.grant.findUnique({ where: { id: grant.id } });
    expect(Number(unchanged.amount)).toBe(10000);
  });

  it.each([
    ['empty title', { title: '   ' }],
    ['invalid deadline', { deadline: 'soon' }],
    ['invalid status', { status: 'ARCHIVED' }],
    ['empty body', {}],
  ])('rejects %s with 422', async (_label, payload) => {
    const grant = await createGrant(manager.user.id);
    const res = await request(app)
      .put(`/api/grants/${grant.id}`)
      .set('Authorization', manager.authHeader)
      .send(payload);

    expect(res.status).toBe(422);
  });

  it('applies a valid partial update', async () => {
    const grant = await createGrant(manager.user.id);
    const res = await request(app)
      .put(`/api/grants/${grant.id}`)
      .set('Authorization', manager.authHeader)
      .send({ title: 'Renamed grant', amount: 4321, status: 'CLOSED' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Renamed grant', amount: 4321, status: 'CLOSED' });
  });

  it('refuses a grant manager editing somebody else\'s grant with 403', async () => {
    const grant = await createGrant(manager.user.id);
    const res = await request(app)
      .put(`/api/grants/${grant.id}`)
      .set('Authorization', otherManager.authHeader)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('lets an admin edit any grant', async () => {
    const grant = await createGrant(manager.user.id);
    const res = await request(app)
      .put(`/api/grants/${grant.id}`)
      .set('Authorization', admin.authHeader)
      .send({ title: 'Admin edit' });

    expect(res.status).toBe(200);
  });

  it('404s for an unknown grant', async () => {
    const res = await request(app)
      .put('/api/grants/11111111-1111-4111-8111-111111111111')
      .set('Authorization', admin.authHeader)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/grants/:id', () => {
  it('lets an admin delete a grant and its applications', async () => {
    const grant = await createGrant(manager.user.id);
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .delete(`/api/grants/${grant.id}`)
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(await prisma.grant.count()).toBe(0);
    expect(await prisma.application.count()).toBe(0);
  });

  it('refuses a grant manager with 403', async () => {
    const grant = await createGrant(manager.user.id);
    const res = await request(app)
      .delete(`/api/grants/${grant.id}`)
      .set('Authorization', manager.authHeader);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown grant', async () => {
    const res = await request(app)
      .delete('/api/grants/11111111-1111-4111-8111-111111111111')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/grants/stats', () => {
  it('aggregates portal-wide figures for an admin', async () => {
    const grant = await createGrant(manager.user.id, { amount: 1000 });
    await createGrant(manager.user.id, { amount: 500, status: 'CLOSED' });
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app).get('/api/grants/stats').set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalGrants: 2,
      openGrants: 1,
      closedGrants: 1,
      totalApplications: 1,
      pendingApplications: 1,
      totalFunding: 1500,
    });
  });

  it('scopes figures to the grant manager\'s own portfolio', async () => {
    await createGrant(manager.user.id, { amount: 1000 });
    await createGrant(otherManager.user.id, { amount: 9999 });

    const res = await request(app)
      .get('/api/grants/stats')
      .set('Authorization', manager.authHeader);

    expect(res.body.data.totalGrants).toBe(1);
    expect(res.body.data.totalFunding).toBe(1000);
  });

  it('refuses an applicant with 403', async () => {
    const res = await request(app)
      .get('/api/grants/stats')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(403);
  });
});
