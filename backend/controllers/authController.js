const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity } = require('../utils/helpers');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    // Retrieve the user including password attribute via scope
    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user.id);
    await logActivity(user.id, 'login', 'auth', 'User logged in');

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tourCompleted: user.tourCompleted },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      tourCompleted: req.user.tourCompleted,
    },
  });
};

exports.updateTourStatus = async (req, res, next) => {
  try {
    const { tourCompleted } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.tourCompleted = tourCompleted === undefined ? true : !!tourCompleted;
    await user.save();

    res.json({
      success: true,
      message: 'Tour status updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tourCompleted: user.tourCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
};
