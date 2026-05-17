const User = require('../models/User');
const { logActivity } = require('../utils/helpers');

exports.getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, isActive } = req.body;
    const user = await User.create({ name, email, password, role, isActive });
    await logActivity(req.user._id, 'create', 'users', `Created user ${email}`);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.password) {
      const user = await User.findById(req.params.id).select('+password');
      user.password = updates.password;
      delete updates.password;
      Object.assign(user, updates);
      await user.save();
      return res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
    }
    delete updates.password;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    await logActivity(req.user._id, 'update', 'users', `Updated user ${user.email}`);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await logActivity(req.user._id, 'delete', 'users', `Deleted user ${user.email}`);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};
