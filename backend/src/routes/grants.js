const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createGrantValidation,
  updateGrantValidation,
  grantIdValidation,
  grantApplicationsValidation,
} = require('../validators/grantValidators');
const {
  getAllGrants,
  getGrantById,
  createGrant,
  updateGrant,
  deleteGrant,
  getGrantStats,
  getGrantApplications,
} = require('../controllers/grantController');

const router = express.Router();

router.use(authenticate);

// Declared before `/:id` so "stats" is not treated as a grant id.
router.get('/stats', authorize('ADMIN', 'GRANT_MANAGER'), getGrantStats);

// Applications for one grant — the caller must own the grant (or be admin).
router.get(
  '/:grantId/applications',
  authorize('ADMIN', 'GRANT_MANAGER'),
  grantApplicationsValidation,
  validate,
  getGrantApplications
);

router.get('/', getAllGrants);
router.get('/:id', grantIdValidation, validate, getGrantById);

router.post('/', authorize('ADMIN', 'GRANT_MANAGER'), createGrantValidation, validate, createGrant);
router.put('/:id', authorize('ADMIN', 'GRANT_MANAGER'), updateGrantValidation, validate, updateGrant);
router.delete('/:id', authorize('ADMIN'), grantIdValidation, validate, deleteGrant);

module.exports = router;
