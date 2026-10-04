const rateLimit = require('express-rate-limit');

/**
 * Enterprise rate limiter for Admin authentication routes
 * 30 attempts per 15 minutes per IP, ignores successful logins
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 failed attempts per 15 minutes
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts from this IP, please try again after 15 minutes.',
  },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
  }
});

/**
 * Global API rate limiter for the entire backend
 * 100 requests per minute per IP
 */
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Global API rate limit exceeded. Please slow down your requests.',
  },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  }
});

module.exports = {
  loginRateLimiter,
  globalApiLimiter
};
