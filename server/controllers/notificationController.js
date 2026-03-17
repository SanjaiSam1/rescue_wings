const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const { limit = 50, onlyUnread = 'false' } = req.query;
    const filter = { userId: req.user._id };
    if (String(onlyUnread) === 'true') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};