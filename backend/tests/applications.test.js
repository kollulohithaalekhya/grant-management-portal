const request = require('supertest');
const {
  app,
  prisma,
  resetData,
  createUserAndLogin,
  createGrant,
  createApplication,
  uniqueEmail,
  ROLES,
} = require('./helpers/factories');

const applicationPayload = (grantId, overrides = {}) => ({
  grantId,
  projectTitle: 'Rooftop Solar for the Community Hall',
  projectDescription: 'Installing a 12kW solar array to cut running costs.',
  requestedAmount: 8000,
  organizationName: 'Community Hall Trust',
  contactEmail: 'trust@example.org',
  ...overrides,
});

let admin;
let owner;
let stranger;
let applicant;
let otherApplicant;
let grant;

beforeEach(async () => {
  await resetData();
  admin = await createUserAndLogin({ email: uniqueEmail('admin'), roles: [ROLES.ADMIN] });
  owner = await createUserAndLogin({ email: uniqueEmail('owner'), roles: [ROLES.GRANT_MANAGER] });
  stranger = await createUserAndLogin({
    email: uniqueEmail('stranger'),
    roles: [ROLES.GRANT_MANAGER],
  });
  applicant = await createUserAndLogin({ email: uniqueEmail('applicant') });
  otherApplicant = await createUserAndLogin({ email: uniqueEmail('applicant2') });
  grant = await createGrant(owner.user.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/applications', () => {
  it('lets an applicant submit and notifies them', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(grant.id));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.requestedAmount).toBe(8000);

    const notifications = await prisma.notification.findMany({
      where: { userId: applicant.user.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('SUCCESS');
  });

  it('refuses a grant manager with 403', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', owner.authHeader)
      .send(applicationPayload(grant.id));

    expect(res.status).toBe(403);
  });

  it('rejects a second application for the same grant with 409', async () => {
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(grant.id));

    expect(res.status).toBe(409);
  });

  it('rejects a closed grant with 400', async () => {
    const closed = await createGrant(owner.user.id, { status: 'CLOSED' });
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(closed.id));

    expect(res.status).toBe(400);
  });

  it('rejects a grant whose deadline has passed with 400', async () => {
    const expired = await createGrant(owner.user.id, {
      deadline: new Date(Date.now() - 86400000),
    });
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(expired.id));

    expect(res.status).toBe(400);
  });

  it('404s for an unknown grant', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload('11111111-1111-4111-8111-111111111111'));

    expect(res.status).toBe(404);
  });

  it.each([
    ['missing project title', { projectTitle: '' }],
    ['non-numeric amount', { requestedAmount: 'plenty' }],
    ['invalid contact email', { contactEmail: 'nope' }],
    ['malformed grant id', { grantId: 'abc' }],
  ])('rejects %s with 422', async (_label, override) => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(grant.id, override));

    expect(res.status).toBe(422);
  });

  it('does not persist a notification when the submission is rejected', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', applicant.authHeader)
      .send(applicationPayload(grant.id, { projectTitle: '' }));

    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('GET /api/applications', () => {
  it('shows applicants only their own submissions', async () => {
    await createApplication(grant.id, applicant.user.id);
    await createApplication(grant.id, otherApplicant.user.id);

    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].applicantId).toBe(applicant.user.id);
  });

  it('shows a grant manager only applications on grants they own', async () => {
    await createApplication(grant.id, applicant.user.id);
    const foreignGrant = await createGrant(stranger.user.id);
    await createApplication(foreignGrant.id, otherApplicant.user.id);

    const mine = await request(app).get('/api/applications').set('Authorization', owner.authHeader);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].grantId).toBe(grant.id);

    const theirs = await request(app)
      .get('/api/applications')
      .set('Authorization', stranger.authHeader);
    expect(theirs.body.data).toHaveLength(1);
    expect(theirs.body.data[0].grantId).toBe(foreignGrant.id);
  });

  it('shows an admin every application', async () => {
    await createApplication(grant.id, applicant.user.id);
    await createApplication(grant.id, otherApplicant.user.id);

    const res = await request(app).get('/api/applications').set('Authorization', admin.authHeader);
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by status', async () => {
    await createApplication(grant.id, applicant.user.id, { status: 'APPROVED' });
    await createApplication(grant.id, otherApplicant.user.id, { status: 'PENDING' });

    const res = await request(app)
      .get('/api/applications?status=APPROVED')
      .set('Authorization', admin.authHeader);

    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/grants/:grantId/applications', () => {
  it('returns applications to the grant manager who owns the grant', async () => {
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .get(`/api/grants/${grant.id}/applications`)
      .set('Authorization', owner.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns 403 to a grant manager who does not own the grant', async () => {
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .get(`/api/grants/${grant.id}/applications`)
      .set('Authorization', stranger.authHeader);

    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  it('returns 403 to an applicant', async () => {
    const res = await request(app)
      .get(`/api/grants/${grant.id}/applications`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/grants/${grant.id}/applications`);
    expect(res.status).toBe(401);
  });

  it('lets an admin read applications for any grant', async () => {
    await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .get(`/api/grants/${grant.id}/applications`)
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('404s for a grant that does not exist', async () => {
    const res = await request(app)
      .get('/api/grants/11111111-1111-4111-8111-111111111111/applications')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(404);
  });

  it('422s for a malformed grant id', async () => {
    const res = await request(app)
      .get('/api/grants/nope/applications')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(422);
  });

  it('supports status filtering and pagination', async () => {
    await createApplication(grant.id, applicant.user.id, { status: 'APPROVED' });
    await createApplication(grant.id, otherApplicant.user.id, { status: 'PENDING' });

    const res = await request(app)
      .get(`/api/grants/${grant.id}/applications?status=PENDING&limit=1`)
      .set('Authorization', owner.authHeader);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('PENDING');
  });
});

describe('GET /api/applications/:id', () => {
  it('lets the applicant read their own application', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.grant.id).toBe(grant.id);
  });

  it('refuses another applicant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', otherApplicant.authHeader);

    expect(res.status).toBe(403);
  });

  it('refuses a grant manager who does not own the grant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', stranger.authHeader);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown application', async () => {
    const res = await request(app)
      .get('/api/applications/11111111-1111-4111-8111-111111111111')
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/applications/:id/review', () => {
  it('lets the owning grant manager approve and notifies the applicant', async () => {
    const application = await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/review`)
      .set('Authorization', owner.authHeader)
      .send({ status: 'APPROVED', reviewNotes: 'Strong proposal.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reviewedById).toBe(owner.user.id);
    expect(res.body.data.reviewerName).toBe(owner.user.name);

    const notification = await prisma.notification.findFirst({
      where: { userId: applicant.user.id },
    });
    expect(notification.type).toBe('SUCCESS');
  });

  it('refuses a grant manager who does not own the grant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/review`)
      .set('Authorization', stranger.authHeader)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(403);

    const untouched = await prisma.application.findUnique({ where: { id: application.id } });
    expect(untouched.status).toBe('PENDING');
    expect(await prisma.notification.count()).toBe(0);
  });

  it('lets an admin review any application', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .patch(`/api/applications/${application.id}/review`)
      .set('Authorization', admin.authHeader)
      .send({ status: 'REJECTED', reviewNotes: 'Out of scope.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('rejects an unsupported status with 422', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .patch(`/api/applications/${application.id}/review`)
      .set('Authorization', owner.authHeader)
      .send({ status: 'MAYBE' });

    expect(res.status).toBe(422);
  });

  it('refuses an applicant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .patch(`/api/applications/${application.id}/review`)
      .set('Authorization', applicant.authHeader)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(403);
  });

  it('404s for an unknown application', async () => {
    const res = await request(app)
      .patch('/api/applications/11111111-1111-4111-8111-111111111111/review')
      .set('Authorization', admin.authHeader)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/applications/:id', () => {
  it('lets an applicant withdraw a pending application', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .delete(`/api/applications/${application.id}`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(await prisma.application.count()).toBe(0);
  });

  it('refuses withdrawing an already reviewed application with 400', async () => {
    const application = await createApplication(grant.id, applicant.user.id, {
      status: 'APPROVED',
    });
    const res = await request(app)
      .delete(`/api/applications/${application.id}`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(400);
  });

  it('refuses another applicant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .delete(`/api/applications/${application.id}`)
      .set('Authorization', otherApplicant.authHeader);

    expect(res.status).toBe(403);
  });

  it('refuses a grant manager who does not own the grant with 403', async () => {
    const application = await createApplication(grant.id, applicant.user.id);
    const res = await request(app)
      .delete(`/api/applications/${application.id}`)
      .set('Authorization', stranger.authHeader);

    expect(res.status).toBe(403);
  });

  it('lets an admin remove any application', async () => {
    const application = await createApplication(grant.id, applicant.user.id, {
      status: 'APPROVED',
    });
    const res = await request(app)
      .delete(`/api/applications/${application.id}`)
      .set('Authorization', admin.authHeader);

    expect(res.status).toBe(200);
  });
});
