const rateLimitMap = new Map();

const websiteRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const max = options.max || 30; // 30 requests per window default
  const message = options.message || 'Too many requests from this IP, please try again later.';

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl}${req.path}_${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, record);
    } else {
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
      } else {
        record.count += 1;
      }
    }

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message,
        retryAfterMs: record.resetTime - now,
      });
    }

    next();
  };
};

module.exports = websiteRateLimiter;
