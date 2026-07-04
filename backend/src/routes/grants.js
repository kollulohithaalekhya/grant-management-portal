const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getAllGrants, getGrantById, createGrant, updateGrant, deleteGrant, getGrantStats,
} = require('../controllers/grantController');

const router = express.Router();

const grantValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('deadline').isISO8601().withMessage('Valid deadline date required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('eligibility').trim().notEmpty().withMessage('Eligibility is required'),
];

router.use(authenticate);

router.get('/stats', authorize('ADMIN', 'GRANT_MANAGER'), getGrantStats);
router.get('/', getAllGrants);
router.get('/:id', getGrantById);
router.post('/', authorize('ADMIN', 'GRANT_MANAGER'), grantValidation, validate, createGrant);
router.put('/:id', authorize('ADMIN', 'GRANT_MANAGER'), validate, updateGrant);
router.delete('/:id', authorize('ADMIN'), deleteGrant);

module.exports = router;
