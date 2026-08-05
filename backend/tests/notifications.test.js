const request = require('supertest');
const {
  app,
  prisma,
  resetData,
  createUserAndLogin,
  createGrant,
  uniqueEmail,
  ROLES,
} = require('./helpers/factories');

let applicant;
let other;

const notify = (userId, overrides = {}) =>
  prisma.notification.create({
    data: {
      userId,
      title: 'Something happened',
      message: 'Details about the thing that happened.',
      type: 'INFO',
      ...overrides,
    },
  });

beforeEach(async () => {
  await resetData();
  applicant = await createUserAndLogin({ email: uniqueEmail('notif') });
  other = await createUserAndLogin({ email: uniqueEmail('notif2') });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/notifications', () => {
  it('returns only the caller\'s notifications with an unread count', async () => {
    await notify(applicant.user.id);
    await notify(applicant.user.id, { isRead: true });
    await notify(other.user.id);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it('paginates', async () => {
    await notify(applicant.user.id);
    await notify(applicant.user.id);

    const res = await request(app)
      .get('/api/notifications?limit=1&page=2')
      .set('Authorization', applicant.authHeader);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 1, totalPages: 2 });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks one notification as read', async () => {
    const notification = await notify(applicant.user.id);

    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    const updated = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(updated.isRead).toBe(true);
  });

  it('refuses somebody else\'s notification with 403', async () => {
    const notification = await notify(other.user.id);

    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown notification', async () => {
    const res = await request(app)
      .patch('/api/notifications/11111111-1111-4111-8111-111111111111/read')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(404);
  });

  it('422s for a malformed id', async () => {
    const res = await request(app)
      .patch('/api/notifications/abc/read')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks every unread notification as read for the caller only', async () => {
    await notify(applicant.user.id);
    await notify(applicant.user.id);
    await notify(other.user.id);

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(await prisma.notification.count({ where: { isRead: false } })).toBe(1);
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('deletes the caller\'s notification', async () => {
    const notification = await notify(applicant.user.id);

    const res = await request(app)
      .delete(`/api/notifications/${notification.id}`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('refuses somebody else\'s notification with 403', async () => {
    const notification = await notify(other.user.id);

    const res = await request(app)
      .delete(`/api/notifications/${notification.id}`)
      .set('Authorization', applicant.authHeader);

    expect(res.status).toBe(403);
    expect(await prisma.notification.count()).toBe(1);
  });
});

describe('cascade behaviour', () => {
  it('removes a user\'s notifications, applications and role rows when the user is deleted', async () => {
    const manager = await createUserAndLogin({
      email: uniqueEmail('cascade'),
      roles: [ROLES.GRANT_MANAGER],
    });
    const grant = await createGrant(manager.user.id);
    await prisma.application.create({
      data: {
        grantId: grant.id,
        applicantId: applicant.user.id,
        projectTitle: 'Cascade test',
        projectDescription: 'Checks the foreign keys.',
        requestedAmount: 100,
        organizationName: 'Org',
        contactEmail: 'org@example.com',
      },
    });
    await notify(applicant.user.id);

    await prisma.user.delete({ where: { id: applicant.user.id } });

    expect(await prisma.application.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.userRole.count({ where: { userId: applicant.user.id } })).toBe(0);
    // The grant survives — it belongs to the manager, not the applicant.
    expect(await prisma.grant.count()).toBe(1);
  });
});
