const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cacheService = require('../services/cacheService');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const cacheKey = `user_profile_${decoded.id}`;
    let user = cacheService.get(cacheKey);
    if (!user) {
      user = await User.findByPk(decoded.id);
      if (user) {
        cacheService.set(cacheKey, user, 60000); // cache user profile for 1 minute
      }
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized' });
  }
};

module.exports = auth;
