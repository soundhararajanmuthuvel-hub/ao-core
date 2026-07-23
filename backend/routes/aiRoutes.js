const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const { 
  getAIInsights, 
  chatAI,
  analyzeLeads,
  customerIntelligence,
  salesAssistant,
  inventoryIntelligence,
  accountsAssistant,
  manufacturingAssistant,
  getDashboardSuggestions,
  aiShoppingChat,
  aiValidateCart,
  aiValidateAddress,
  aiCreateOrder,
  aiGeneratePayment,
  aiGetOrderStatus,
  getCustomerInsights,
  getProductInsights,
  getSalesInsights,
  getInventoryInsights,
  getManufacturingInsights,
  getCrmInsights
} = require('../controllers/aiController');

// Flexible Auth Middleware for AI Shopping Endpoints
const aiAuthMiddleware = (req, res, next) => {
  if (req.headers['x-api-key'] || req.headers['X-API-Key']) {
    return websiteApiKeyAuth(req, res, next);
  }
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return websiteApiKeyAuth(req, res, next);
  }
  // Allow request to proceed (optional key)
  next();
};

// Storefront AI Shopping APIs (Called via Next.js Proxy or direct API Key)
router.post('/chat', aiAuthMiddleware, aiShoppingChat);
router.post('/cart', aiAuthMiddleware, aiValidateCart);
router.post('/address', aiAuthMiddleware, aiValidateAddress);
router.post('/order', aiAuthMiddleware, aiCreateOrder);
router.post('/payment', aiAuthMiddleware, aiGeneratePayment);
router.get('/order-status', aiAuthMiddleware, aiGetOrderStatus);

// Internal ERP Admin AI Analytics APIs (Requires Session Auth)
router.get('/insights', auth, getAIInsights);
router.get('/suggestions', auth, getDashboardSuggestions);
router.post('/analyze-leads', auth, analyzeLeads);
router.post('/customer-intelligence', auth, customerIntelligence);
router.post('/sales-assistant', auth, salesAssistant);
router.post('/inventory-intelligence', auth, inventoryIntelligence);
router.post('/accounts-assistant', auth, accountsAssistant);
router.post('/manufacturing-assistant', auth, manufacturingAssistant);

// AI Data Layer endpoints
router.get('/customer-insights', auth, getCustomerInsights);
router.get('/product-insights', auth, getProductInsights);
router.get('/sales-insights', auth, getSalesInsights);
router.get('/inventory-insights', auth, getInventoryInsights);
router.get('/manufacturing-insights', auth, getManufacturingInsights);
router.get('/crm-insights', auth, getCrmInsights);

module.exports = router;
