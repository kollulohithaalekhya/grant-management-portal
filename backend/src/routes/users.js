const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  userIdValidation,
  updateRolesValidation,
  updateProfileValidation,
  changePasswordValidation,
} = require('../validators/userValidators');
const {
  getAllUsers,
  getUserById,
  updateUserRoles,
  toggleUserActive,
  updateProfile,
  changePassword,
} = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);

// Self-service — declared before the `/:id` routes.
router.put('/profile', updateProfileValidation, validate, updateProfile);
router.put('/password', changePasswordValidation, validate, changePassword);

// Admin-only user administration.
router.get('/', authorize('ADMIN'), getAllUsers);
router.get('/:id', authorize('ADMIN'), userIdValidation, validate, getUserById);
router.put('/:id/roles', authorize('ADMIN'), updateRolesValidation, validate, updateUserRoles);
router.patch(
  '/:id/toggle-active',
  authorize('ADMIN'),
  userIdValidation,
  validate,
  toggleUserActive
);

module.exports = router;
