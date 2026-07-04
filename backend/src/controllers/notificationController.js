const { sendSuccess, sendError } = require('../utils/response');
const db = require('../db');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const all = await db.notifications.find({ userId }).sort({ createdAt: -1 });
    const total = all.length;
    const unreadCount = all.filter((n) => !n.isRead).length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = all.slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      success: true,
      data: paginated,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const notification = await db.notifications.findOne({ _id: req.params.id });
    if (!notification) return sendError(res, 'Notification not found', 404);
    if (notification.userId !== userId) return sendError(res, 'Access denied', 403);

    await db.notifications.update({ _id: req.params.id }, { $set: { isRead: true } });
    return sendSuccess(res, null, 'Marked as read');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    await db.notifications.update({ userId, isRead: false }, { $set: { isRead: true } }, { multi: true });
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const notification = await db.notifications.findOne({ _id: req.params.id });
    if (!notification) return sendError(res, 'Notification not found', 404);
    if (notification.userId !== userId) return sendError(res, 'Access denied', 403);

    await db.notifications.remove({ _id: req.params.id });
    return sendSuccess(res, null, 'Notification deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
