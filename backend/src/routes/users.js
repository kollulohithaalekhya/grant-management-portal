const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getAllUsers, getUserById, updateUserRole, toggleUserActive, updateProfile, changePassword,
} = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);

router.put('/profile', updateProfile);
router.put('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], validate, changePassword);

// Admin routes
router.get('/', authorize('ADMIN'), getAllUsers);
router.get('/:id', authorize('ADMIN'), getUserById);
router.put('/:id/role', authorize('ADMIN'), [body('role').notEmpty()], validate, updateUserRole);
router.patch('/:id/toggle-active', authorize('ADMIN'), toggleUserActive);

module.exports = router;
