const { Op } = require('sequelize');
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const whereClause = {
      [Op.or]: [{ userId: null }, { userId: req.user.id }],
    };

    // Filter by read/unread status
    if (req.query.status === 'unread') {
      whereClause.isRead = false;
    } else if (req.query.status === 'read') {
      whereClause.isRead = true;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    const unreadCount = await Notification.count({
      where: {
        isRead: false,
        [Op.or]: [{ userId: null }, { userId: req.user.id }],
      },
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const { isRead } = req.body;
    await Notification.update(
      { isRead: isRead !== undefined ? isRead : true },
      { where: { id: req.params.id } }
    );
    res.json({ message: 'Marked status updated' });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true },
      {
        where: {
          isRead: false,
          [Op.or]: [{ userId: null }, { userId: req.user.id }],
        },
      }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const result = await Notification.destroy({
      where: {
        id: req.params.id,
        [Op.or]: [{ userId: null }, { userId: req.user.id }],
      },
    });
    if (!result) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.clearAllNotifications = async (req, res, next) => {
  try {
    await Notification.destroy({
      where: {
        [Op.or]: [{ userId: null }, { userId: req.user.id }],
      },
    });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
};
