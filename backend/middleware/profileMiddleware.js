const { AsyncLocalStorage } = require('async_hooks');

const profileStorage = new AsyncLocalStorage();
exports.profileStorage = profileStorage;

exports.profileMiddleware = (req, res, next) => {
  const startHrTime = process.hrtime();
  const context = {
    url: req.originalUrl || req.url,
    method: req.method,
    queryTimeMs: 0,
    queriesCount: 0
  };

  profileStorage.run(context, () => {
    // Intercept res.json and res.send to compute serialization and response times
    const originalJson = res.json;
    const originalSend = res.send;

    const finalizeProfiling = (body) => {
      const endHrTime = process.hrtime(startHrTime);
      const totalTimeMs = (endHrTime[0] * 1000) + (endHrTime[1] / 1000000);

      // Measure serialization time
      const serializeStart = process.hrtime();
      const str = typeof body === 'object' ? JSON.stringify(body) : String(body);
      const serializeEnd = process.hrtime(serializeStart);
      const serializationTimeMs = (serializeEnd[0] * 1000) + (serializeEnd[1] / 1000000);

      const dbQueryTimeMs = context.queryTimeMs;
      const businessLogicTimeMs = totalTimeMs - dbQueryTimeMs - serializationTimeMs;

      // Log performance details for slow endpoints (> 100ms)
      if (totalTimeMs > 100) {
        console.log(
          `[Profiler] ⚠️ SLOW API DETECTED: ${context.method} ${context.url} took ${totalTimeMs.toFixed(2)}ms ` +
          `(DB Query: ${dbQueryTimeMs.toFixed(2)}ms [${context.queriesCount} queries], ` +
          `Logic: ${businessLogicTimeMs.toFixed(2)}ms, Serial: ${serializationTimeMs.toFixed(2)}ms)`
        );
      }
    };

    res.json = function (data) {
      finalizeProfiling(data);
      return originalJson.apply(this, arguments);
    };

    res.send = function (data) {
      finalizeProfiling(data);
      return originalSend.apply(this, arguments);
    };

    next();
  });
};
