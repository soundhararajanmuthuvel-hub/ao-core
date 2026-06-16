const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (req.user.role === 'admin' || req.user.role === 'Super Admin') {
    return next();
  }
  if (roles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied' });
};

module.exports = authorize;
