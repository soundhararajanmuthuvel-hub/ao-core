const WebsiteApiKey = require('../models/WebsiteApiKey');

const websiteApiKeyAuth = async (req, res, next) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] || req.headers['X-API-Key'];
    let token = apiKeyHeader;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'API Key missing. X-API-Key header or Bearer API token is required for storefront access.',
      });
    }

    // Check active API key in database
    const activeKey = await WebsiteApiKey.findOne({
      where: {
        apiKey: token,
        status: 'Active',
      },
    });

    // Fallback: Also support system seeded website key
    const systemFallbackKeys = [
      process.env.BLO_WEBSITE_API_KEY,
      process.env.WEBSITE_API_KEY,
      process.env.STOREFRONT_API_KEY,
      'blovit_live_sec_99382174620091823746',
    ].filter(Boolean);

    const isAuthorized = !!activeKey || systemFallbackKeys.includes(token);

    console.log(`[websiteApiKeyAuth] received API key: "${token}"`);
    console.log(`[websiteApiKeyAuth] expected API keys: DB match=${!!activeKey}, Fallback keys=[${systemFallbackKeys.join(', ')}]`);
    console.log(`[websiteApiKeyAuth] authentication result: ${isAuthorized ? 'PASSED' : 'FAILED'}`);

    if (!isAuthorized) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked Storefront API Key.',
      });
    }

    if (activeKey) {
      activeKey.lastUsedAt = new Date();
      await activeKey.save().catch(() => {});
      req.apiKeyRecord = activeKey;
    }

    req.isWebsiteRequest = true;
    next();
  } catch (err) {
    console.error('Website API Key Middleware Error:', err);
    res.status(500).json({ success: false, message: 'API Key Verification Failed' });
  }
};

module.exports = websiteApiKeyAuth;
