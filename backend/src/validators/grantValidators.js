const { body, param } = require('express-validator');

const GRANT_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'];

const grantIdParam = (name = 'id') =>
  param(name).isUUID().withMessage('Grant id must be a valid UUID');

const createGrantValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number').toFloat(),
  body('deadline').isISO8601().withMessage('Valid deadline date required'),
  body('category').trim().notEmpty().withMessage('Category is required').isLength({ max: 100 }),
  body('eligibility').trim().notEmpty().withMessage('Eligibility is required'),
  body('status').optional().isIn(GRANT_STATUSES).withMessage(`Status must be one of: ${GRANT_STATUSES.join(', ')}`),
];

/**
 * Update accepts a partial payload, but every field that *is* present must be
 * valid — previously this route ran `validate` with no rules, so any body was
 * accepted.
 */
const updateGrantValidation = [
  grantIdParam('id'),
  body().custom((value) => {
    if (!value || Object.keys(value).length === 0) {
      throw new Error('At least one field must be provided');
    }
    return true;
  }),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be a positive number').toFloat(),
  body('deadline').optional().isISO8601().withMessage('Valid deadline date required'),
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty').isLength({ max: 100 }),
  body('eligibility').optional().trim().notEmpty().withMessage('Eligibility cannot be empty'),
  body('status').optional().isIn(GRANT_STATUSES).withMessage(`Status must be one of: ${GRANT_STATUSES.join(', ')}`),
];

const grantIdValidation = [grantIdParam('id')];
const grantApplicationsValidation = [grantIdParam('grantId')];

module.exports = {
  GRANT_STATUSES,
  createGrantValidation,
  updateGrantValidation,
  grantIdValidation,
  grantApplicationsValidation,
};
