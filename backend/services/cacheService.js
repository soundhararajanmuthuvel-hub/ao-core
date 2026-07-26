const NodeCache = require('node-cache');

// Initialize with a default standard TTL of 5 minutes (300s) 
// and check for expired keys every 60 seconds.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

exports.get = (key) => {
  return cache.get(key) || null;
};

// If ttlMs is passed, convert to seconds, otherwise rely on stdTTL
exports.set = (key, value, ttlMs) => {
  if (ttlMs) {
    cache.set(key, value, Math.floor(ttlMs / 1000));
  } else {
    cache.set(key, value);
  }
};

exports.delete = (key) => {
  cache.del(key);
};

exports.clear = () => {
  cache.flushAll();
};
