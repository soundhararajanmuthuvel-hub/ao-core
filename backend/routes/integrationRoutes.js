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
  forceRefreshProduct,
  
  createConnection,
  getConnections,
  updateConnection,
  deleteConnection,
  testConnection,
  syncNow,
  getMarketplaceLogs,
  getMappings,
  saveMappings,
  handleMarketplaceWebhook,
  getMarketplaceStats
} = require('../controllers/integrationController');

// Webhook endpoints (public bypass)
router.post('/webhook', handleWooWebhook);
router.post('/marketplace-webhook', handleMarketplaceWebhook);

// Universal SaaS Integrations Marketplace CRUD & Actions
router.post('/', auth, authorize('admin'), createConnection);
router.get('/', auth, authorize('admin'), getConnections);
router.put('/:id', auth, authorize('admin'), updateConnection);
router.delete('/:id', auth, authorize('admin'), deleteConnection);
router.post('/test', auth, authorize('admin'), testConnection);
router.post('/sync', auth, authorize('admin'), syncNow);
router.get('/logs', auth, authorize('admin'), getMarketplaceLogs);
router.get('/mappings', auth, authorize('admin'), getMappings);
router.post('/mappings', auth, authorize('admin'), saveMappings);
router.get('/stats', auth, authorize('admin'), getMarketplaceStats);

// Authentication & Admin Role Gate for user triggers (Legacy WooCommerce endpoints)
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
router.get('/woo-stats', auth, authorize('admin'), getWooIntegrationStats);
router.get('/sync-logs', auth, authorize('admin'), getSyncLogs);

module.exports = router;
