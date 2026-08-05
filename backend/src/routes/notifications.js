const express = require('express');
const { param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

const notificationIdValidation = [
  param('id').isUUID().withMessage('Notification id must be a valid UUID'),
];

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', notificationIdValidation, validate, markAsRead);
router.delete('/:id', notificationIdValidation, validate, deleteNotification);

module.exports = router;
