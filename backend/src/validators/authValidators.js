const { body } = require('express-validator');

const passwordRules = (field) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  passwordRules('password'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshValidation = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
];

module.exports = { registerValidation, loginValidation, refreshValidation, passwordRules };
