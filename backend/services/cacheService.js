const cache = {};

exports.get = (key) => {
  const item = cache[key];
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    delete cache[key];
    return null;
  }
  return item.value;
};

exports.set = (key, value, ttlMs = 300000) => { // Default TTL: 5 minutes
  cache[key] = {
    value,
    expiry: Date.now() + ttlMs
  };
};

exports.delete = (key) => {
  delete cache[key];
};

exports.clear = () => {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
};
