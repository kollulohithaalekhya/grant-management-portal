require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./index');

const seed = async () => {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await db.users.remove({}, { multi: true });
  await db.grants.remove({}, { multi: true });
  await db.applications.remove({}, { multi: true });
  await db.notifications.remove({}, { multi: true });

  const now = new Date().toISOString();

  // Create users
  const adminPass = await bcrypt.hash('Admin@123', 12);
  const managerPass = await bcrypt.hash('Manager@123', 12);
  const applicantPass = await bcrypt.hash('Applicant@123', 12);

  const admin = await db.users.insert({
    _id: uuidv4(),
    name: 'System Admin',
    email: 'admin@grantportal.com',
    password: adminPass,
    role: 'ADMIN',
    provider: 'local',
    avatar: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const manager = await db.users.insert({
    _id: uuidv4(),
    name: 'Grant Manager',
    email: 'manager@grantportal.com',
    password: managerPass,
    role: 'GRANT_MANAGER',
    provider: 'local',
    avatar: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const applicant = await db.users.insert({
    _id: uuidv4(),
    name: 'Jane Applicant',
    email: 'applicant@grantportal.com',
    password: applicantPass,
    role: 'APPLICANT',
    provider: 'local',
    avatar: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Create grants
  const grant1 = await db.grants.insert({
    _id: uuidv4(),
    title: 'Community Development Fund 2025',
    description: 'Funding for community-based development initiatives focused on education, healthcare, and infrastructure.',
    amount: 50000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    category: 'Community Development',
    eligibility: 'Non-profit organizations with at least 2 years of operation.',
    createdBy: manager._id,
    createdAt: now,
    updatedAt: now,
  });

  const grant2 = await db.grants.insert({
    _id: uuidv4(),
    title: 'STEM Education Initiative',
    description: 'Supporting STEM programs for underrepresented youth in schools.',
    amount: 25000,
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    category: 'Education',
    eligibility: 'Public schools and accredited educational institutions.',
    createdBy: manager._id,
    createdAt: now,
    updatedAt: now,
  });

  await db.grants.insert({
    _id: uuidv4(),
    title: 'Green Energy Innovation Grant',
    description: 'Funding research and development of renewable energy solutions.',
    amount: 100000,
    deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'CLOSED',
    category: 'Environment',
    eligibility: 'Research institutions and startups in the energy sector.',
    createdBy: admin._id,
    createdAt: now,
    updatedAt: now,
  });

  // Create application
  await db.applications.insert({
    _id: uuidv4(),
    grantId: grant1._id,
    applicantId: applicant._id,
    status: 'PENDING',
    projectTitle: 'Youth Community Center Renovation',
    projectDescription: 'Renovating the local youth community center to provide better facilities for 500+ youth in our area.',
    requestedAmount: 45000,
    organizationName: 'Youth First Foundation',
    contactEmail: 'contact@youthfirst.org',
    documents: [],
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Create notifications
  await db.notifications.insert({
    _id: uuidv4(),
    userId: applicant._id,
    title: 'Application Submitted',
    message: 'Your application for "Community Development Fund 2025" has been submitted successfully.',
    type: 'SUCCESS',
    isRead: false,
    createdAt: now,
  });

  console.log('✅ Seed complete!');
  console.log('\n🔑 Login credentials:');
  console.log('  Admin:   admin@grantportal.com     / Admin@123');
  console.log('  Manager: manager@grantportal.com   / Manager@123');
  console.log('  User:    applicant@grantportal.com / Applicant@123');
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
