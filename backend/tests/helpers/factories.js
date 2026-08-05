const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { ROLES } = require('../../src/constants/roles');

const DEFAULT_PASSWORD = 'Password@123';

/** Empties every table except the immutable role catalogue. */
const resetData = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "notifications", "refresh_tokens", "applications", "grants", "user_roles", "users" RESTART IDENTITY CASCADE'
  );
};

let counter = 0;
const uniqueEmail = (prefix = 'user') => {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.com`;
};

/** Creates a user with an explicit role set (registration only yields APPLICANT). */
const createUser = async ({
  name = 'Test User',
  email = uniqueEmail(),
  password = DEFAULT_PASSWORD,
  roles = [ROLES.APPLICANT],
  isActive = true,
} = {}) => {
  const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } });
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: password ? await bcrypt.hash(password, 4) : null,
      isActive,
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
  });
  return { ...user, plainPassword: password };
};

/** Logs in over HTTP so tests exercise the real token issuance path. */
const login = async (email, password = DEFAULT_PASSWORD) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
};

/**
 * Creates a user, logs it in, and returns the session plus a ready-to-use
 * bearer header. `user` is the API-shaped record with the plaintext password
 * attached so tests can re-authenticate.
 */
const createUserAndLogin = async (options = {}) => {
  const created = await createUser(options);
  const session = await login(created.email, created.plainPassword);
  return {
    ...session,
    user: { ...session.user, plainPassword: created.plainPassword },
    authHeader: `Bearer ${session.accessToken}`,
  };
};

const createGrant = async (createdById, overrides = {}) =>
  prisma.grant.create({
    data: {
      title: 'Test Grant',
      description: 'A grant used by the integration tests.',
      amount: 10000,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'OPEN',
      category: 'Testing',
      eligibility: 'Anyone running the test suite.',
      createdById,
      ...overrides,
    },
  });

const createApplication = async (grantId, applicantId, overrides = {}) =>
  prisma.application.create({
    data: {
      grantId,
      applicantId,
      projectTitle: 'Test Project',
      projectDescription: 'Project description for the integration tests.',
      requestedAmount: 5000,
      organizationName: 'Test Org',
      contactEmail: 'contact@test-org.example',
      ...overrides,
    },
  });

module.exports = {
  DEFAULT_PASSWORD,
  ROLES,
  app,
  prisma,
  resetData,
  uniqueEmail,
  createUser,
  createUserAndLogin,
  createGrant,
  createApplication,
  login,
};
