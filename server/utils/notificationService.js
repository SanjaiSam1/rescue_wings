const Notification = require('../models/Notification');

const normalizeLinkedId = (linkedId) => (linkedId ? String(linkedId) : '');

const emitNotification = (io, notification) => {
  if (!io || !notification?.userId) return;
  io.to(`user_${notification.userId}`).emit('notification:new', notification);
};

const createNotification = async (io, payload) => {
  const notification = await Notification.create({
    userId: payload.userId,
    role: payload.role,
    type: payload.type,
    message: payload.message,
    linkedId: normalizeLinkedId(payload.linkedId),
    data: payload.data || {},
  });

  const plain = notification.toObject();
  emitNotification(io, plain);
  return plain;
};

const createNotificationsForUsers = async (io, payload) => {
  const uniqueUserIds = Array.from(new Set((payload.userIds || []).map((id) => String(id))));
  if (!uniqueUserIds.length) return [];

  const docs = uniqueUserIds.map((userId) => ({
    userId,
    role: payload.role,
    type: payload.type,
    message: payload.message,
    linkedId: normalizeLinkedId(payload.linkedId),
    data: payload.data || {},
  }));

  const created = await Notification.insertMany(docs, { ordered: false });
  const plainItems = created.map((item) => item.toObject());
  plainItems.forEach((item) => emitNotification(io, item));
  return plainItems;
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
};