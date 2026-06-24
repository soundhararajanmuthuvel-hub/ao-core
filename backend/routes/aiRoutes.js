const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getAIInsights, 
  chatAI,
  analyzeLeads,
  customerIntelligence,
  salesAssistant,
  inventoryIntelligence,
  accountsAssistant,
  manufacturingAssistant,
  getDashboardSuggestions
} = require('../controllers/aiController');

router.get('/insights', auth, getAIInsights);
router.get('/suggestions', auth, getDashboardSuggestions);
router.post('/chat', auth, chatAI);
router.post('/analyze-leads', auth, analyzeLeads);
router.post('/customer-intelligence', auth, customerIntelligence);
router.post('/sales-assistant', auth, salesAssistant);
router.post('/inventory-intelligence', auth, inventoryIntelligence);
router.post('/accounts-assistant', auth, accountsAssistant);
router.post('/manufacturing-assistant', auth, manufacturingAssistant);

// AI Data Layer endpoints
const {
  getCustomerInsights,
  getProductInsights,
  getSalesInsights,
  getInventoryInsights,
  getManufacturingInsights,
  getCrmInsights
} = require('../controllers/aiController');

router.get('/customer-insights', auth, getCustomerInsights);
router.get('/product-insights', auth, getProductInsights);
router.get('/sales-insights', auth, getSalesInsights);
router.get('/inventory-insights', auth, getInventoryInsights);
router.get('/manufacturing-insights', auth, getManufacturingInsights);
router.get('/crm-insights', auth, getCrmInsights);

module.exports = router;
