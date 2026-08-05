const ROLES = {
  ADMIN: 'ADMIN',
  GRANT_MANAGER: 'GRANT_MANAGER',
  APPLICANT: 'APPLICANT',
};

const ALL_ROLES = Object.values(ROLES);

const ROLE_DESCRIPTIONS = {
  ADMIN: 'Full access: manages users, roles, grants and applications.',
  GRANT_MANAGER: 'Creates grants and reviews applications for grants they own.',
  APPLICANT: 'Browses open grants and submits applications.',
};

module.exports = { ROLES, ALL_ROLES, ROLE_DESCRIPTIONS };
