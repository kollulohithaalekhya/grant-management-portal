const { body, param } = require('express-validator');
const { ALL_ROLES } = require('../constants/roles');
const { passwordRules } = require('./authValidators');

const userIdValidation = [param('id').isUUID().withMessage('User id must be a valid UUID')];

/**
 * Accepts either `{ roles: ["ADMIN", "GRANT_MANAGER"] }` or the legacy single
 * `{ role: "ADMIN" }`, and requires at least one known role either way.
 */
const updateRolesValidation = [
  ...userIdValidation,
  body('roles')
    .optional()
    .isArray({ min: 1 })
    .withMessage('roles must be a non-empty array'),
  body('roles.*')
    .optional()
    .isIn(ALL_ROLES)
    .withMessage(`Each role must be one of: ${ALL_ROLES.join(', ')}`),
  body('role')
    .optional()
    .isIn(ALL_ROLES)
    .withMessage(`Role must be one of: ${ALL_ROLES.join(', ')}`),
  body().custom((value) => {
    if (!value || (!Array.isArray(value.roles) && !value.role)) {
      throw new Error('Provide `roles` (array) or `role` (string)');
    }
    return true;
  }),
];

const updateProfileValidation = [
  body().custom((value) => {
    if (!value || (value.name === undefined && value.avatar === undefined)) {
      throw new Error('Provide `name` and/or `avatar`');
    }
    return true;
  }),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 120 }),
  body('avatar').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword'),
];

module.exports = {
  userIdValidation,
  updateRolesValidation,
  updateProfileValidation,
  changePasswordValidation,
};
