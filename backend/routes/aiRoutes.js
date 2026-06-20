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
  manufacturingAssistant
} = require('../controllers/aiController');

router.get('/insights', auth, getAIInsights);
router.post('/chat', auth, chatAI);
router.post('/analyze-leads', auth, analyzeLeads);
router.post('/customer-intelligence', auth, customerIntelligence);
router.post('/sales-assistant', auth, salesAssistant);
router.post('/inventory-intelligence', auth, inventoryIntelligence);
router.post('/accounts-assistant', auth, accountsAssistant);
router.post('/manufacturing-assistant', auth, manufacturingAssistant);

module.exports = router;
