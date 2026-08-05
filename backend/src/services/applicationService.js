const prisma = require('../lib/prisma');
const { ApiError } = require('../utils/errors');
const { ROLES } = require('../constants/roles');
const { serializeApplication } = require('../lib/serializers');
const grantService = require('./grantService');

const detailInclude = {
  grant: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
  applicant: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
};

const listInclude = {
  grant: { select: { id: true, title: true, createdById: true } },
  applicant: { select: { id: true, name: true, email: true } },
};

const isAdmin = (user) => user.roles.includes(ROLES.ADMIN);
const isGrantManager = (user) => user.roles.includes(ROLES.GRANT_MANAGER);

/**
 * Restricts a query to what the caller is allowed to see:
 *   ADMIN          — everything
 *   GRANT_MANAGER  — applications submitted to grants they created
 *   APPLICANT      — their own submissions
 * A user holding several roles gets the union of those scopes.
 */
const visibilityFilter = (user) => {
  if (isAdmin(user)) return {};

  const scopes = [];
  if (isGrantManager(user)) scopes.push({ grant: { createdById: user.id } });
  if (user.roles.includes(ROLES.APPLICANT)) scopes.push({ applicantId: user.id });

  if (scopes.length === 0) return { id: { equals: '00000000-0000-0000-0000-000000000000' } };
  if (scopes.length === 1) return scopes[0];
  return { OR: scopes };
};

const list = async (user, { page = 1, limit = 10, status, grantId }) => {
  const where = { AND: [visibilityFilter(user)] };
  if (status) where.AND.push({ status });
  if (grantId) where.AND.push({ grantId });

  const [total, rows] = await prisma.$transaction([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, applications: rows.map(serializeApplication) };
};

/**
 * Applications for one grant. The caller must own the grant (or be an admin) —
 * a grant manager cannot read submissions to somebody else's grant.
 */
const listForGrant = async (user, grantId, { page = 1, limit = 10, status }) => {
  await grantService.assertCanReviewGrant(user, grantId);

  const where = { grantId };
  if (status) where.status = status;

  const [total, rows] = await prisma.$transaction([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, applications: rows.map(serializeApplication) };
};

const getById = async (user, id) => {
  const application = await prisma.application.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!application) throw ApiError.notFound('Application not found');

  const owns = application.applicantId === user.id;
  const managesGrant = isGrantManager(user) && application.grant.createdById === user.id;
  if (!isAdmin(user) && !owns && !managesGrant) {
    throw ApiError.forbidden('Access denied');
  }

  return serializeApplication(application);
};

/**
 * Creates the application and its confirmation notification atomically, so an
 * applicant is never told about a submission that failed to persist.
 */
const submit = async (user, data) => {
  const grant = await prisma.grant.findUnique({ where: { id: data.grantId } });
  if (!grant) throw ApiError.notFound('Grant not found');
  if (grant.status !== 'OPEN') throw ApiError.badRequest('Grant is not open for applications');
  if (new Date(grant.deadline) < new Date()) throw ApiError.badRequest('Grant deadline has passed');

  const existing = await prisma.application.findUnique({
    where: { grantId_applicantId: { grantId: grant.id, applicantId: user.id } },
  });
  if (existing) throw ApiError.conflict('You have already applied for this grant');

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        grantId: grant.id,
        applicantId: user.id,
        projectTitle: data.projectTitle,
        projectDescription: data.projectDescription,
        requestedAmount: data.requestedAmount,
        organizationName: data.organizationName,
        contactEmail: data.contactEmail,
      },
      include: listInclude,
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        title: 'Application Submitted',
        message: `Your application for "${grant.title}" has been submitted successfully.`,
        type: 'SUCCESS',
      },
    });

    return serializeApplication(application);
  });
};

const REVIEW_STATUSES = ['APPROVED', 'REJECTED', 'UNDER_REVIEW'];

const statusMessage = (status, grantTitle, reviewNotes) => {
  switch (status) {
    case 'APPROVED':
      return `Congratulations! Your application for "${grantTitle}" has been approved.`;
    case 'REJECTED':
      return `Your application for "${grantTitle}" has been rejected.${
        reviewNotes ? ` Notes: ${reviewNotes}` : ''
      }`;
    default:
      return `Your application for "${grantTitle}" is now under review.`;
  }
};

/**
 * Records a review decision and notifies the applicant in one transaction.
 * Grant managers may only review applications for grants they own.
 */
const review = async (user, id, { status, reviewNotes }) => {
  if (!REVIEW_STATUSES.includes(status)) {
    throw ApiError.badRequest(`Status must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: { grant: true },
  });
  if (!application) throw ApiError.notFound('Application not found');

  await grantService.assertCanReviewGrant(user, application.grantId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: detailInclude,
    });

    await tx.notification.create({
      data: {
        userId: application.applicantId,
        title: `Application ${status.replace('_', ' ')}`,
        message: statusMessage(status, application.grant.title, reviewNotes),
        type: status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' ? 'ERROR' : 'INFO',
      },
    });

    return serializeApplication(updated);
  });
};

/** Applicants may withdraw their own pending applications; admins may remove any. */
const withdraw = async (user, id) => {
  const application = await prisma.application.findUnique({
    where: { id },
    include: { grant: { select: { createdById: true } } },
  });
  if (!application) throw ApiError.notFound('Application not found');

  const owns = application.applicantId === user.id;
  const managesGrant = isGrantManager(user) && application.grant.createdById === user.id;

  if (!isAdmin(user) && !owns && !managesGrant) {
    throw ApiError.forbidden('Access denied');
  }
  if (owns && !isAdmin(user) && !managesGrant && application.status !== 'PENDING') {
    throw ApiError.badRequest('Only pending applications can be withdrawn');
  }

  await prisma.application.delete({ where: { id } });
};

module.exports = {
  list,
  listForGrant,
  getById,
  submit,
  review,
  withdraw,
  visibilityFilter,
  REVIEW_STATUSES,
};
