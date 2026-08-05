const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  applicationIdValidation,
  submitApplicationValidation,
  reviewApplicationValidation,
} = require('../validators/applicationValidators');
const {
  submitApplication,
  getApplications,
  getApplicationById,
  reviewApplication,
  withdrawApplication,
} = require('../controllers/applicationController');

const router = express.Router();

router.use(authenticate);

router.get('/', getApplications);
router.get('/:id', applicationIdValidation, validate, getApplicationById);

router.post(
  '/',
  authorize('APPLICANT'),
  submitApplicationValidation,
  validate,
  submitApplication
);

router.patch(
  '/:id/review',
  authorize('ADMIN', 'GRANT_MANAGER'),
  reviewApplicationValidation,
  validate,
  reviewApplication
);

router.delete('/:id', applicationIdValidation, validate, withdrawApplication);

module.exports = router;
