const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

exports.getActivity = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { count: total, rows: logs } = await ActivityLog.findAndCountAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};
