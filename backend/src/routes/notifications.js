const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getNotifications, markAsRead, markAllAsRead, deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
