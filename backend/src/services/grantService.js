const prisma = require('../lib/prisma');
const { ApiError } = require('../utils/errors');
const { ROLES } = require('../constants/roles');
const { serializeGrant } = require('../lib/serializers');

const creatorSelect = { createdBy: { select: { id: true, name: true, email: true } } };

const isAdmin = (user) => user.roles.includes(ROLES.ADMIN);
const isGrantManager = (user) => user.roles.includes(ROLES.GRANT_MANAGER);

const list = async (user, { page = 1, limit = 10, status, category, search }) => {
  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Applicants may only discover grants that are open for submissions.
  if (!isAdmin(user) && !isGrantManager(user)) {
    where.status = 'OPEN';
  }

  const [total, rows] = await prisma.$transaction([
    prisma.grant.count({ where }),
    prisma.grant.findMany({
      where,
      include: creatorSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, grants: rows.map(serializeGrant) };
};

const getById = async (id) => {
  const grant = await prisma.grant.findUnique({
    where: { id },
    include: { ...creatorSelect, _count: { select: { applications: true } } },
  });
  if (!grant) throw ApiError.notFound('Grant not found');
  return serializeGrant(grant);
};

const create = async (user, data) => {
  const grant = await prisma.grant.create({
    data: {
      title: data.title,
      description: data.description,
      amount: data.amount,
      deadline: new Date(data.deadline),
      category: data.category,
      eligibility: data.eligibility,
      status: data.status || 'OPEN',
      createdById: user.id,
    },
    include: creatorSelect,
  });
  return serializeGrant(grant);
};

/**
 * A grant manager may only edit grants they created; admins may edit any.
 */
const assertCanManage = (user, grant) => {
  if (isAdmin(user)) return;
  if (grant.createdById !== user.id) {
    throw ApiError.forbidden('You do not own this grant');
  }
};

const update = async (user, id, data) => {
  const grant = await prisma.grant.findUnique({ where: { id } });
  if (!grant) throw ApiError.notFound('Grant not found');
  assertCanManage(user, grant);

  const patch = {};
  for (const field of ['title', 'description', 'category', 'eligibility', 'status']) {
    if (data[field] !== undefined) patch[field] = data[field];
  }
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.deadline !== undefined) patch.deadline = new Date(data.deadline);

  const updated = await prisma.grant.update({
    where: { id },
    data: patch,
    include: creatorSelect,
  });
  return serializeGrant(updated);
};

/**
 * Deleting a grant removes its applications too. Both statements run in one
 * transaction so a grant can never be left with orphaned application rows.
 */
const remove = async (id) => {
  const grant = await prisma.grant.findUnique({ where: { id } });
  if (!grant) throw ApiError.notFound('Grant not found');

  await prisma.$transaction([
    prisma.application.deleteMany({ where: { grantId: id } }),
    prisma.grant.delete({ where: { id } }),
  ]);
};

/**
 * Ownership gate for grant-scoped reads. Admins see everything; a grant
 * manager only sees grants they created. Anyone else is refused.
 */
const assertCanReviewGrant = async (user, grantId) => {
  const grant = await prisma.grant.findUnique({
    where: { id: grantId },
    include: creatorSelect,
  });
  if (!grant) throw ApiError.notFound('Grant not found');

  if (isAdmin(user)) return grant;
  if (isGrantManager(user) && grant.createdById === user.id) return grant;

  throw ApiError.forbidden('You do not have access to applications for this grant');
};

const getStats = async (user) => {
  // Grant managers see figures for their own portfolio; admins see everything.
  const scoped = isAdmin(user) ? {} : { createdById: user.id };
  const applicationScope = isAdmin(user) ? {} : { grant: { createdById: user.id } };

  const [
    totalGrants,
    openGrants,
    closedGrants,
    totalApplications,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    totalUsers,
    funding,
  ] = await prisma.$transaction([
    prisma.grant.count({ where: scoped }),
    prisma.grant.count({ where: { ...scoped, status: 'OPEN' } }),
    prisma.grant.count({ where: { ...scoped, status: 'CLOSED' } }),
    prisma.application.count({ where: applicationScope }),
    prisma.application.count({ where: { ...applicationScope, status: 'PENDING' } }),
    prisma.application.count({ where: { ...applicationScope, status: 'APPROVED' } }),
    prisma.application.count({ where: { ...applicationScope, status: 'REJECTED' } }),
    prisma.user.count(),
    prisma.grant.aggregate({ where: scoped, _sum: { amount: true } }),
  ]);

  return {
    totalGrants,
    openGrants,
    closedGrants,
    totalApplications,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    totalUsers,
    totalFunding: Number(funding._sum.amount || 0),
  };
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getStats,
  assertCanManage,
  assertCanReviewGrant,
  isAdmin,
  isGrantManager,
};
