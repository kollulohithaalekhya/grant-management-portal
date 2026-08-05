const { body, param } = require('express-validator');

const REVIEW_STATUSES = ['APPROVED', 'REJECTED', 'UNDER_REVIEW'];

const applicationIdValidation = [
  param('id').isUUID().withMessage('Application id must be a valid UUID'),
];

const submitApplicationValidation = [
  body('grantId').isUUID().withMessage('Grant id must be a valid UUID'),
  body('projectTitle').trim().notEmpty().withMessage('Project title is required').isLength({ max: 200 }),
  body('projectDescription').trim().notEmpty().withMessage('Project description is required'),
  body('requestedAmount')
    .isFloat({ gt: 0 })
    .withMessage('Requested amount must be a positive number')
    .toFloat(),
  body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
  body('contactEmail').isEmail().withMessage('Valid contact email required').normalizeEmail(),
];

const reviewApplicationValidation = [
  ...applicationIdValidation,
  body('status')
    .isIn(REVIEW_STATUSES)
    .withMessage(`Status must be one of: ${REVIEW_STATUSES.join(', ')}`),
  body('reviewNotes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
];

module.exports = {
  REVIEW_STATUSES,
  applicationIdValidation,
  submitApplicationValidation,
  reviewApplicationValidation,
};
