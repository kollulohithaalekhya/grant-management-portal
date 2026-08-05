const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  app,
  prisma,
  resetData,
  createUser,
  createUserAndLogin,
  createGrant,
  uniqueEmail,
  ROLES,
} = require('./helpers/factories');

beforeEach(resetData);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('role-based access control', () => {
  it('lets an admin list users', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('admin'), roles: [ROLES.ADMIN] });
    const res = await request(app).get('/api/users').set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('refuses an applicant listing users with 403', async () => {
    const applicant = await createUserAndLogin({ email: uniqueEmail('app') });
    const res = await request(app).get('/api/users').set('Authorization', applicant.authHeader);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permission/i);
  });

  it('refuses a grant manager listing users with 403', async () => {
    const manager = await createUserAndLogin({
      email: uniqueEmail('mgr'),
      roles: [ROLES.GRANT_MANAGER],
    });
    const res = await request(app).get('/api/users').set('Authorization', manager.authHeader);

    expect(res.status).toBe(403);
  });

  it('requires authentication before the role check', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('grants access when the user holds one of several accepted roles', async () => {
    const both = await createUserAndLogin({
      email: uniqueEmail('both'),
      roles: [ROLES.APPLICANT, ROLES.GRANT_MANAGER],
    });

    // /api/grants/stats accepts ADMIN or GRANT_MANAGER.
    const res = await request(app).get('/api/grants/stats').set('Authorization', both.authHeader);
    expect(res.status).toBe(200);
  });

  it('lets a dual-role user act through both roles', async () => {
    const dual = await createUserAndLogin({
      email: uniqueEmail('dual'),
      roles: [ROLES.APPLICANT, ROLES.GRANT_MANAGER],
    });

    // GRANT_MANAGER capability
    const created = await request(app)
      .post('/api/grants')
      .set('Authorization', dual.authHeader)
      .send({
        title: 'Dual role grant',
        description: 'Created by a user holding two roles.',
        amount: 1000,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        category: 'Testing',
        eligibility: 'Everyone',
      });
    expect(created.status).toBe(201);

    // APPLICANT capability, on someone else's grant
    const otherManager = await createUser({
      email: uniqueEmail('other'),
      roles: [ROLES.GRANT_MANAGER],
    });
    const otherGrant = await createGrant(otherManager.id);

    const applied = await request(app)
      .post('/api/applications')
      .set('Authorization', dual.authHeader)
      .send({
        grantId: otherGrant.id,
        projectTitle: 'Dual role application',
        projectDescription: 'Submitted through the APPLICANT role.',
        requestedAmount: 500,
        organizationName: 'Dual Org',
        contactEmail: 'dual@example.com',
      });
    expect(applied.status).toBe(201);
  });
});

describe('PUT /api/users/:id/roles', () => {
  const adminSession = async () =>
    createUserAndLogin({ email: uniqueEmail('roleadmin'), roles: [ROLES.ADMIN] });

  it('replaces a user\'s roles and reflects them in the next token', async () => {
    const admin = await adminSession();
    const target = await createUser({ email: uniqueEmail('promote') });

    const res = await request(app)
      .put(`/api/users/${target.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({ roles: [ROLES.GRANT_MANAGER, ROLES.ADMIN] });

    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual([ROLES.ADMIN, ROLES.GRANT_MANAGER]);

    const stored = await prisma.userRole.findMany({ where: { userId: target.id } });
    expect(stored).toHaveLength(2);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: target.email, password: target.plainPassword });
    expect(jwt.decode(login.body.data.accessToken).roles.sort()).toEqual([
      ROLES.ADMIN,
      ROLES.GRANT_MANAGER,
    ]);
  });

  it('accepts the single-role shape', async () => {
    const admin = await adminSession();
    const target = await createUser({ email: uniqueEmail('single') });

    const res = await request(app)
      .put(`/api/users/${target.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({ role: ROLES.GRANT_MANAGER });

    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual([ROLES.GRANT_MANAGER]);
  });

  it('rejects an unknown role with 422', async () => {
    const admin = await adminSession();
    const target = await createUser({ email: uniqueEmail('badrole') });

    const res = await request(app)
      .put(`/api/users/${target.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({ roles: ['SUPER_USER'] });

    expect(res.status).toBe(422);
  });

  it('rejects an empty payload with 422', async () => {
    const admin = await adminSession();
    const target = await createUser({ email: uniqueEmail('emptyrole') });

    const res = await request(app)
      .put(`/api/users/${target.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({});

    expect(res.status).toBe(422);
  });

  it('rejects a non-UUID user id with 422', async () => {
    const admin = await adminSession();
    const res = await request(app)
      .put('/api/users/not-a-uuid/roles')
      .set('Authorization', admin.authHeader)
      .send({ roles: [ROLES.ADMIN] });

    expect(res.status).toBe(422);
  });

  it('refuses a non-admin with 403', async () => {
    const applicant = await createUserAndLogin({ email: uniqueEmail('nonadmin') });
    const target = await createUser({ email: uniqueEmail('victim') });

    const res = await request(app)
      .put(`/api/users/${target.id}/roles`)
      .set('Authorization', applicant.authHeader)
      .send({ roles: [ROLES.ADMIN] });

    expect(res.status).toBe(403);
  });

  it('stops an admin removing their own ADMIN role', async () => {
    const admin = await adminSession();
    const res = await request(app)
      .put(`/api/users/${admin.user.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({ roles: [ROLES.APPLICANT] });

    expect(res.status).toBe(400);
  });

  it('404s for a user that does not exist', async () => {
    const admin = await adminSession();
    const res = await request(app)
      .put('/api/users/11111111-1111-4111-8111-111111111111/roles')
      .set('Authorization', admin.authHeader)
      .send({ roles: [ROLES.ADMIN] });

    expect(res.status).toBe(404);
  });

  it('takes effect immediately for tokens issued before the change', async () => {
    const admin = await adminSession();
    const target = await createUserAndLogin({ email: uniqueEmail('live') });

    // Token says APPLICANT; the middleware reloads roles from the database.
    await request(app)
      .put(`/api/users/${target.user.id}/roles`)
      .set('Authorization', admin.authHeader)
      .send({ roles: [ROLES.GRANT_MANAGER] });

    const res = await request(app).get('/api/auth/me').set('Authorization', target.authHeader);
    expect(res.body.data.user.roles).toEqual([ROLES.GRANT_MANAGER]);
  });
});

describe('user administration', () => {
  it('lists users filtered by role', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('filter'), roles: [ROLES.ADMIN] });
    await createUser({ email: uniqueEmail('m1'), roles: [ROLES.GRANT_MANAGER] });
    await createUser({ email: uniqueEmail('a1') });

    const res = await request(app)
      .get('/api/users?role=GRANT_MANAGER')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roles).toEqual([ROLES.GRANT_MANAGER]);
  });

  it('searches users by name', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('search'), roles: [ROLES.ADMIN] });
    await createUser({ name: 'Distinctive Name', email: uniqueEmail('dn') });

    const res = await request(app)
      .get('/api/users?search=Distinctive')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('fetches one user by id', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('getone'), roles: [ROLES.ADMIN] });
    const target = await createUser({ email: uniqueEmail('target') });

    const res = await request(app)
      .get(`/api/users/${target.id}`)
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(target.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('toggles a user between active and inactive', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('toggle'), roles: [ROLES.ADMIN] });
    const target = await createUser({ email: uniqueEmail('togglee') });

    const off = await request(app)
      .patch(`/api/users/${target.id}/toggle-active`)
      .set('Authorization', admin.authHeader);
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);

    const on = await request(app)
      .patch(`/api/users/${target.id}/toggle-active`)
      .set('Authorization', admin.authHeader);
    expect(on.body.data.isActive).toBe(true);
  });

  it('stops an admin deactivating themselves', async () => {
    const admin = await createUserAndLogin({ email: uniqueEmail('self'), roles: [ROLES.ADMIN] });
    const res = await request(app)
      .patch(`/api/users/${admin.user.id}/toggle-active`)
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(400);
  });
});

describe('self-service profile routes', () => {
  it('updates the display name', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('profile') });
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', session.authHeader)
      .send({ name: 'Renamed Person' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Person');
  });

  it('rejects an empty profile payload with 422', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('emptyprofile') });
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', session.authHeader)
      .send({});

    expect(res.status).toBe(422);
  });

  it('changes the password and invalidates the old one', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('pw') });

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', session.authHeader)
      .send({ currentPassword: session.user.plainPassword, newPassword: 'BrandNew@123' });
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: session.user.email, password: session.user.plainPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: session.user.email, password: 'BrandNew@123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a wrong current password with 400', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('wrongcur') });
    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', session.authHeader)
      .send({ currentPassword: 'Nope@12345', newPassword: 'BrandNew@123' });

    expect(res.status).toBe(400);
  });

  it('rejects a weak new password with 422', async () => {
    const session = await createUserAndLogin({ email: uniqueEmail('weaknew') });
    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', session.authHeader)
      .send({ currentPassword: session.user.plainPassword, newPassword: 'weak' });

    expect(res.status).toBe(422);
  });
});
