const { getUserAccessScopes } = require('../controllers/authController');

/**
 * Middleware to enforce required access scope (e.g. 'management_billing' or 'website_admin')
 */
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const role = (req.user.role || '').toLowerCase();
    if (role === 'super admin' || role === 'admin' || role === 'developer') {
      return next();
    }

    const scopes = getUserAccessScopes(req.user.role);
    if (!scopes.includes(requiredScope)) {
      return res.status(403).json({
        message: `Forbidden: Your account does not have access to '${requiredScope}' endpoints.`
      });
    }
    next();
  };
};

module.exports = {
  requireScope
};
