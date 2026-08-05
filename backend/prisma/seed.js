/**
 * Idempotent development seed.
 *
 * Roles are always upserted (the application cannot assign a role that is not
 * provisioned). Demo users, grants and applications are only created when the
 * database is empty, so re-running never duplicates data.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { ROLES, ROLE_DESCRIPTIONS } = require('../src/constants/roles');

const prisma = new PrismaClient();

const seedRoles = async () => {
  for (const name of Object.values(ROLES)) {
    await prisma.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name] },
      create: { name, description: ROLE_DESCRIPTIONS[name] },
    });
  }
  console.log('✅ Roles provisioned:', Object.values(ROLES).join(', '));
};

const createUser = async ({ name, email, password, roles }) => {
  const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } });
  return prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 12),
      provider: 'LOCAL',
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
  });
};

const seedDemoData = async () => {
  if ((await prisma.user.count()) > 0) {
    console.log('ℹ️  Users already exist — skipping demo data.');
    return;
  }

  const admin = await createUser({
    name: 'System Admin',
    email: 'admin@grantportal.com',
    password: 'Admin@123',
    roles: [ROLES.ADMIN],
  });

  const manager = await createUser({
    name: 'Grant Manager',
    email: 'manager@grantportal.com',
    password: 'Manager@123',
    roles: [ROLES.GRANT_MANAGER],
  });

  // Demonstrates the many-to-many design: two concurrent roles on one account.
  const leadManager = await createUser({
    name: 'Lead Program Officer',
    email: 'lead@grantportal.com',
    password: 'Lead@1234',
    roles: [ROLES.GRANT_MANAGER, ROLES.ADMIN],
  });

  const applicant = await createUser({
    name: 'Jane Applicant',
    email: 'applicant@grantportal.com',
    password: 'Applicant@123',
    roles: [ROLES.APPLICANT],
  });

  const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const community = await prisma.grant.create({
    data: {
      title: 'Community Development Fund 2025',
      description:
        'Funding for community-based development initiatives focused on education, healthcare, and infrastructure.',
      amount: 50000,
      deadline: days(30),
      status: 'OPEN',
      category: 'Community Development',
      eligibility: 'Non-profit organizations with at least 2 years of operation.',
      createdById: manager.id,
    },
  });

  await prisma.grant.create({
    data: {
      title: 'STEM Education Initiative',
      description: 'Supporting STEM programs for underrepresented youth in schools.',
      amount: 25000,
      deadline: days(45),
      status: 'OPEN',
      category: 'Education',
      eligibility: 'Public schools and accredited educational institutions.',
      createdById: leadManager.id,
    },
  });

  await prisma.grant.create({
    data: {
      title: 'Green Energy Innovation Grant',
      description: 'Funding research and development of renewable energy solutions.',
      amount: 100000,
      deadline: days(-5),
      status: 'CLOSED',
      category: 'Environment',
      eligibility: 'Research institutions and startups in the energy sector.',
      createdById: admin.id,
    },
  });

  await prisma.application.create({
    data: {
      grantId: community.id,
      applicantId: applicant.id,
      status: 'PENDING',
      projectTitle: 'Youth Community Center Renovation',
      projectDescription:
        'Renovating the local youth community center to provide better facilities for 500+ youth in our area.',
      requestedAmount: 45000,
      organizationName: 'Youth First Foundation',
      contactEmail: 'contact@youthfirst.org',
    },
  });

  await prisma.notification.create({
    data: {
      userId: applicant.id,
      title: 'Application Submitted',
      message:
        'Your application for "Community Development Fund 2025" has been submitted successfully.',
      type: 'SUCCESS',
    },
  });

  console.log('\n🔑 Demo credentials:');
  console.log('  Admin:                admin@grantportal.com     / Admin@123');
  console.log('  Grant Manager:        manager@grantportal.com   / Manager@123');
  console.log('  Manager + Admin:      lead@grantportal.com      / Lead@1234');
  console.log('  Applicant:            applicant@grantportal.com / Applicant@123');
};

const main = async () => {
  console.log('🌱 Seeding database...');
  await seedRoles();
  await seedDemoData();
  console.log('\n✅ Seed complete.');
};

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
