/**
 * Row -> API shape mappers. They drop secrets (password hashes), flatten the
 * user_roles join into a plain string array, and convert Prisma `Decimal`
 * columns to JSON numbers so clients keep receiving numeric amounts.
 */

const toNumber = (value) => (value === null || value === undefined ? value : Number(value));

const roleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((entry) => (typeof entry === 'string' ? entry : entry.role && entry.role.name))
    .filter(Boolean)
    .sort();
};

const serializeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: roleNames(user),
    provider: user.provider,
    avatar: user.avatar,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const serializeGrant = (grant) => {
  if (!grant) return null;
  const { createdBy, _count, applications, ...rest } = grant;
  return {
    ...rest,
    amount: toNumber(grant.amount),
    createdByName: createdBy ? createdBy.name : undefined,
    applicationCount: _count ? _count.applications : undefined,
  };
};

const serializeApplication = (application) => {
  if (!application) return null;
  const { grant, applicant, reviewedBy, ...rest } = application;
  return {
    ...rest,
    requestedAmount: toNumber(application.requestedAmount),
    grant: grant ? serializeGrant(grant) : undefined,
    grantTitle: grant ? grant.title : undefined,
    applicantName: applicant ? applicant.name : undefined,
    applicantEmail: applicant ? applicant.email : undefined,
    reviewerName: reviewedBy ? reviewedBy.name : null,
  };
};

const serializeNotification = (notification) => notification;

module.exports = {
  toNumber,
  roleNames,
  serializeUser,
  serializeGrant,
  serializeApplication,
  serializeNotification,
};
