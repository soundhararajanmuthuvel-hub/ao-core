const { Op } = require('sequelize');
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const whereClause = {
      [Op.or]: [{ userId: null }, { userId: req.user.id }],
    };

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    const unreadCount = await Notification.count({
      where: {
        isRead: false,
        ...whereClause,
      },
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    await Notification.update({ isRead: true }, { where: { id: req.params.id } });
    res.json({ message: 'Marked as read' });
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
