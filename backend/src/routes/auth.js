const express = require('express');
const {
  register,
  login,
  refresh,
  logout,
  me,
  googleRedirect,
  googleCallback,
} = require('../controllers/authController');
const { authenticate, attachTokenPayload } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerValidation,
  loginValidation,
  refreshValidation,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/refresh', refreshValidation, validate, refresh);
router.post('/logout', attachTokenPayload, logout);
router.get('/me', authenticate, me);

// --- Google OAuth 2.0 (authorization code flow) ---------------------------
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

module.exports = router;
