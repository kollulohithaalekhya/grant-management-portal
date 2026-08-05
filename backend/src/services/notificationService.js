const prisma = require('../lib/prisma');
const { ApiError } = require('../utils/errors');

const list = async (userId, { page = 1, limit = 20 }) => {
  const [total, unreadCount, notifications] = await prisma.$transaction([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, unreadCount, notifications };
};

const assertOwned = async (userId, id) => {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw ApiError.notFound('Notification not found');
  if (notification.userId !== userId) throw ApiError.forbidden('Access denied');
  return notification;
};

const markAsRead = async (userId, id) => {
  await assertOwned(userId, id);
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
};

const markAllAsRead = (userId) =>
  prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });

const remove = async (userId, id) => {
  await assertOwned(userId, id);
  await prisma.notification.delete({ where: { id } });
};

module.exports = { list, markAsRead, markAllAsRead, remove };
