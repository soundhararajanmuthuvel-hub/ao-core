const jwt = require('jsonwebtoken');
const WebsiteCustomer = require('../models/WebsiteCustomer');

const JWT_SECRET = process.env.JWT_SECRET || 'ao_core_secret_key_2026_prod';

const websiteCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required. Please log in.',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please log in again.',
      });
    }

    if (!decoded || !decoded.customerId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token payload.',
      });
    }

    const customer = await WebsiteCustomer.findByPk(decoded.customerId);
    if (!customer || !customer.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Customer account not found or deactivated.',
      });
    }

    req.websiteCustomer = customer;
    next();
  } catch (err) {
    console.error('Website Customer Auth Middleware Error:', err);
    res.status(500).json({ success: false, message: 'Authentication process failed.' });
  }
};

module.exports = websiteCustomerAuth;
