const notificationService = require('../services/notificationService');
const { sendSuccess } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query, 20);
    const { total, unreadCount, notifications } = await notificationService.list(req.user.id, {
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Notifications fetched',
      data: notifications,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.user.id, req.params.id);
    return sendSuccess(res, null, 'Marked as read');
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res, next) => {
  try {
    await notificationService.remove(req.user.id, req.params.id);
    return sendSuccess(res, null, 'Notification deleted');
  } catch (err) {
    return next(err);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
