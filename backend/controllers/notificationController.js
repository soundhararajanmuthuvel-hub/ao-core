const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [{ user: null }, { user: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({
      isRead: false,
      $or: [{ user: null }, { user: req.user._id }],
    });
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { isRead: false, $or: [{ user: null }, { user: req.user._id }] },
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
};
