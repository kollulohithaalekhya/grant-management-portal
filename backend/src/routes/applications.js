const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  submitApplication, getApplications, getApplicationById, reviewApplication, withdrawApplication,
} = require('../controllers/applicationController');

const router = express.Router();

router.use(authenticate);

router.get('/', getApplications);
router.get('/:id', getApplicationById);

router.post(
  '/',
  authorize('APPLICANT'),
  [
    body('grantId').notEmpty().withMessage('Grant ID is required'),
    body('projectTitle').trim().notEmpty().withMessage('Project title is required'),
    body('projectDescription').trim().notEmpty().withMessage('Project description is required'),
    body('requestedAmount').isNumeric().withMessage('Requested amount must be a number'),
    body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
    body('contactEmail').isEmail().withMessage('Valid contact email required'),
  ],
  validate,
  submitApplication
);

router.patch(
  '/:id/review',
  authorize('ADMIN', 'GRANT_MANAGER'),
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  reviewApplication
);

router.delete('/:id', withdrawApplication);

module.exports = router;
