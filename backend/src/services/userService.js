const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const config = require('../config');
const { ApiError } = require('../utils/errors');
const { ROLES, ALL_ROLES } = require('../constants/roles');
const { serializeUser } = require('../lib/serializers');

const withRoles = { roles: { include: { role: true } } };

const findById = (id) => prisma.user.findUnique({ where: { id }, include: withRoles });

const findByEmail = (email) =>
  prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: withRoles });

/** Resolves role names to rows, rejecting unknown names before any write. */
const resolveRoles = async (names, client = prisma) => {
  const unique = [...new Set(names)];
  const unknown = unique.filter((name) => !ALL_ROLES.includes(name));
  if (unknown.length) {
    throw ApiError.badRequest(`Unknown role(s): ${unknown.join(', ')}`);
  }
  const rows = await client.role.findMany({ where: { name: { in: unique } } });
  if (rows.length !== unique.length) {
    throw ApiError.badRequest('One or more roles are not provisioned in the database');
  }
  return rows;
};

/**
 * Creates a user and its role assignments atomically — a user must never be
 * persisted without at least one role.
 */
const createUser = async ({ name, email, password, provider = 'LOCAL', providerId = null, avatar = null, roles = [ROLES.APPLICANT] }, client = prisma) => {
  const roleRows = await resolveRoles(roles, client);
  return client.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password,
      provider,
      providerId,
      avatar,
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
    include: withRoles,
  });
};

const listUsers = async ({ page = 1, limit = 10, role, search }) => {
  const where = {};
  if (role) where.roles = { some: { role: { name: role } } };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: withRoles,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { total, users: rows.map(serializeUser) };
};

/**
 * Replaces a user's role set in a single transaction so a failure can never
 * leave the account with no roles at all.
 */
const replaceUserRoles = async (userId, roles) => {
  const roleRows = await resolveRoles(roles);
  const user = await findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
      data: roleRows.map((role) => ({ userId, roleId: role.id })),
    });
    return tx.user.findUnique({ where: { id: userId }, include: withRoles });
  });
};

const setActive = async (userId, isActive) => {
  const user = await findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    include: withRoles,
  });
};

const updateProfile = async (userId, { name, avatar }) => {
  const data = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;
  return prisma.user.update({ where: { id: userId }, data, include: withRoles });
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (!user.password) {
    throw ApiError.badRequest('Password change is not available for OAuth accounts');
  }

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  const hashed = await bcrypt.hash(newPassword, config.bcryptRounds);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
};

module.exports = {
  withRoles,
  findById,
  findByEmail,
  createUser,
  listUsers,
  replaceUserRoles,
  setActive,
  updateProfile,
  changePassword,
};
