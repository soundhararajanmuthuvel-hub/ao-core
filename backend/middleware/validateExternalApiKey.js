const IntegrationExportCredential = require('../models/IntegrationExportCredential');
const IntegrationLog = require('../models/IntegrationLog');

// In-memory rate limiting map: { apiKey: [timestamps] }
const rateLimitMap = new Map();

const validateExternalApiKey = async (req, res, next) => {
  const startTime = Date.now();
  let apiKey = null;

  // Enforce Authorization: Bearer <API_KEY> format, fall back to x-api-key for backwards compatibility
  if (req.headers.authorization?.startsWith('Bearer ')) {
    apiKey = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  }

  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      message: 'Missing API Key in headers (Authorization: Bearer <API_KEY> or X-API-KEY required).' 
    });
  }

  try {
    // 1. Fetch credentials
    let cred = await IntegrationExportCredential.findOne({ where: { apiKey } });

    if (!cred) {
      return res.status(401).json({ success: false, message: 'Invalid API Key.' });
    }

    // 2. Validate Status
    if (cred.status !== 'Active') {
      return res.status(403).json({ success: false, message: `API Key status is ${cred.status}. Access denied.` });
    }

    // 3. Verify Expiry
    if (cred.expiryDate && new Date() > new Date(cred.expiryDate)) {
      cred.status = 'Expired';
      await cred.save();
      return res.status(403).json({ success: false, message: 'API Key has expired.' });
    }

    // 4. IP Whitelisting
    if (cred.allowedIps) {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const whitelisted = cred.allowedIps.split(',').map(ip => ip.trim());
      // Handle simple ipv6 wrapper if present
      const cleanIp = clientIp.replace(/^.*:/, ''); 
      
      const isAllowed = whitelisted.some(w => {
        if (w === '*' || w === '0.0.0.0' || w === cleanIp || clientIp.includes(w)) return true;
        return false;
      });

      if (!isAllowed) {
        // Log unauthorized IP attempt
        const now = new Date();
        await IntegrationLog.create({
          connectionId: 0,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0],
          entityType: 'Export API',
          action: 'Export',
          recordsImported: 0,
          recordsFailed: 1,
          status: 'Failed',
          duration: Date.now() - startTime,
          errorMessage: `IP Blocked: Request from unauthorized client IP address ${clientIp}`,
          tenantId: cred.tenantId
        });
        return res.status(403).json({ success: false, message: `Access denied: Client IP ${clientIp} is not in the whitelist.` });
      }
    }

    // 5. Rate Limiting Check
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute
    let timestamps = rateLimitMap.get(apiKey) || [];
    
    // Filter timestamps outside current window
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= (cred.rateLimitCount || 60)) {
      // Log Rate Limit exceeded
      const d = new Date();
      await IntegrationLog.create({
        connectionId: 0,
        date: d.toISOString().split('T')[0],
        time: d.toTimeString().split(' ')[0],
        entityType: 'Export API',
        action: 'Export',
        recordsImported: 0,
        recordsFailed: 1,
        status: 'Failed',
        duration: Date.now() - startTime,
        errorMessage: 'Rate limit exceeded: More than configured requests per minute',
        tenantId: cred.tenantId
      });
      return res.status(429).json({ success: false, message: 'Too many requests. Rate limit exceeded. Try again in a minute.' });
    }

    // Record this request
    timestamps.push(now);
    rateLimitMap.set(apiKey, timestamps);

    // Set Tenant context for downstream controllers
    req.tenantId = cred.tenantId;
    req.exportCredentialId = cred.id;
    req.exportCredentialName = cred.name;

    next();
  } catch (err) {
    console.error('External API Auth Error:', err);
    res.status(500).json({ success: false, message: 'Internal authentication process error.' });
  }
};

module.exports = validateExternalApiKey;
