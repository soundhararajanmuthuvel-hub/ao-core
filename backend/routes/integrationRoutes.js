const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
  testWooConnection,
  connectWooWebsite,
  disconnectWooWebsite,
  triggerProductSync,
  triggerProductImport,
  triggerCustomerSync,
  triggerOrderSync,
  triggerInventorySync,
  triggerSyncAll,
  getWooIntegrationStats,
  getSyncLogs,
  handleWooWebhook,
  forceRefreshProduct
} = require('../controllers/integrationController');

// Webhook endpoint (public bypass)
router.post('/webhook', handleWooWebhook);

// Authentication & Admin Role Gate for user triggers
router.post('/test-connection', auth, authorize('admin'), testWooConnection);
router.post('/connect', auth, authorize('admin'), connectWooWebsite);
router.post('/disconnect', auth, authorize('admin'), disconnectWooWebsite);
router.post('/sync/products', auth, authorize('admin'), triggerProductSync);
router.post('/sync/products-import', auth, authorize('admin'), triggerProductImport);
router.post('/sync/customers', auth, authorize('admin'), triggerCustomerSync);
router.post('/sync/orders', auth, authorize('admin'), triggerOrderSync);
router.post('/sync/inventory', auth, authorize('admin'), triggerInventorySync);
router.post('/sync/all', auth, authorize('admin'), triggerSyncAll);
router.post('/sync/product/:id', auth, authorize('admin'), forceRefreshProduct);
router.get('/stats', auth, authorize('admin'), getWooIntegrationStats);
router.get('/sync-logs', auth, authorize('admin'), getSyncLogs);

module.exports = router;
