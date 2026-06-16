const { Op } = require('sequelize');
const User = require('../models/User');
const { logActivity } = require('../utils/helpers');

exports.getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    const query = search
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const { count: total, rows: users } = await User.findAndCountAll({
      where: query,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, isActive } = req.body;
    const user = await User.create({ name, email, password, role, isActive });
    await logActivity(req.user.id, 'create', 'users', `Created user ${email}`);
    
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    let user;

    if (updates.password) {
      // Need to hash password via hook/methods, fetch model instance
      const userWithPw = await User.scope('withPassword').findByPk(req.params.id);
      if (!userWithPw) return res.status(404).json({ message: 'User not found' });

      userWithPw.password = updates.password;
      delete updates.password;
      Object.assign(userWithPw, updates);
      await userWithPw.save();
      
      // Reload User (without password)
      user = await User.findByPk(req.params.id);
    } else {
      delete updates.password;
      user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      await user.update(updates);
    }

    await logActivity(req.user.id, 'update', 'users', `Updated user ${user.email}`);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }
    
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await user.destroy();
    await logActivity(req.user.id, 'delete', 'users', `Deleted user ${user.email}`);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};
