/**
 * websiteRateLimiter.js
 *
 * Factory wrapper around express-rate-limit.
 * Replaces the previous hand-rolled Map implementation which accumulated
 * entries indefinitely (no TTL cleanup = memory leak on long-running processes).
 *
 * For multi-instance / horizontally scaled deployments, swap the default
 * in-memory store for rate-limit-redis:
 *   const { RedisStore } = require('rate-limit-redis');
 *   store: new RedisStore({ client: redisClient })
 */
const rateLimit = require('express-rate-limit');

/**
 * @param {object} options
 * @param {number} [options.windowMs=900000]  Window in ms (default: 15 min)
 * @param {number} [options.max=30]           Max requests per window (default: 30)
 * @param {string} [options.message]          Override response message
 * @returns {import('express').RequestHandler}
 */
const websiteRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 30,
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,     // Disable X-RateLimit-* headers (deprecated)
    message: {
      success: false,
      message: options.message || 'Too many requests from this IP, please try again later.',
    },
    // Use the real IP — respects X-Forwarded-For when behind a trusted proxy
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
  });
};

module.exports = websiteRateLimiter;
