const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (req.user.role === 'Super Admin') {
    return next();
  }
  
  // Future-proofing: If we start passing granular permissions (e.g. 'products.read')
  // we can evaluate it against req.user.permissions here. For now, strict role match.
  if (roles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied' });
};

module.exports = authorize;
