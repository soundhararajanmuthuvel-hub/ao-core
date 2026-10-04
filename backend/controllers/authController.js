const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity } = require('../utils/helpers');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const getUserAccessScopes = (role) => {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'super admin' || normalized === 'admin' || normalized === 'developer') {
    return ['management_billing', 'website_admin'];
  }
  if (normalized === 'website admin' || normalized === 'storefront manager' || normalized === 'ecommerce admin' || normalized === 'marketing manager') {
    return ['website_admin'];
  }
  // Default ERP / Management & Billing for all operational and business roles
  return ['management_billing'];
};

exports.getUserAccessScopes = getUserAccessScopes;

exports.login = async (req, res, next) => {
  try {
    const { email, password, portal } = req.body;
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

    const accessScopes = getUserAccessScopes(user.role);
    const requestedPortal = portal || 'management_billing';

    if (requestedPortal === 'website_admin' && !accessScopes.includes('website_admin')) {
      return res.status(403).json({
        message: 'Access Denied: Your account role does not have permission for Website Admin.'
      });
    }

    if (requestedPortal === 'management_billing' && !accessScopes.includes('management_billing')) {
      return res.status(403).json({
        message: 'Access Denied: Your account role does not have permission for Management & Billing.'
      });
    }

    const token = generateToken(user.id);
    await logActivity(user.id, 'login', 'auth', `User logged in to ${requestedPortal === 'website_admin' ? 'Website Admin' : 'Management & Billing'}`);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessScopes,
        activeScope: requestedPortal,
        tourCompleted: user.tourCompleted,
        mustChangePassword: user.mustChangePassword
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  const accessScopes = getUserAccessScopes(req.user.role);
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      accessScopes,
      tourCompleted: req.user.tourCompleted,
      mustChangePassword: req.user.mustChangePassword,
    },
  });
};

exports.updateTourStatus = async (req, res, next) => {
  try {
    const cacheService = require('../services/cacheService');
    const { tourCompleted } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.tourCompleted = tourCompleted === undefined ? true : !!tourCompleted;
    await user.save();
    
    cacheService.delete(`user_profile_${user.id}`);

    res.json({
      success: true,
      message: 'Tour status updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tourCompleted: user.tourCompleted,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const cacheService = require('../services/cacheService');
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.password = password;
    user.mustChangePassword = false;
    await user.save();
    
    cacheService.delete(`user_profile_${user.id}`);
    await logActivity(user.id, 'update', 'auth', 'User changed temporary password');

    res.json({
      success: true,
      message: 'Password changed successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tourCompleted: user.tourCompleted,
        mustChangePassword: false
      }
    });
  } catch (err) {
    next(err);
  }
};
