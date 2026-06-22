const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const validateExternalApiKey = require('../middleware/validateExternalApiKey');
const externalController = require('../controllers/externalController');

// ==========================================
// DEVELOPER CREDENTIALS ADMINISTRATION (Admin role)
// ==========================================
router.post('/credentials', auth, authorize('admin'), externalController.createExportCredential);
router.get('/credentials', auth, authorize('admin'), externalController.listExportCredentials);
router.delete('/credentials/:id', auth, authorize('admin'), externalController.deleteExportCredential);
router.post('/credentials/:id/regenerate', auth, authorize('admin'), externalController.regenerateExportCredential);

// ==========================================
// PUBLIC HEALTH CHECK FOR SAAS / EXTERNAL LINKS
// ==========================================
router.get('/health', externalController.getHealth);

// ==========================================
// SECURE EXTERNAL DATA EXPORTS (API Key authenticated)
// ==========================================
router.get('/products', validateExternalApiKey, externalController.getProducts);
router.get('/customers', validateExternalApiKey, externalController.getCustomers);
router.get('/orders', validateExternalApiKey, externalController.getOrders);
router.get('/invoices', validateExternalApiKey, externalController.getInvoices);
router.get('/catalogues', validateExternalApiKey, externalController.getCatalogues);
router.get('/outstanding', validateExternalApiKey, externalController.getOutstanding);
router.get('/reports', validateExternalApiKey, externalController.getReports);
router.get('/settings', validateExternalApiKey, externalController.getSettings);
router.post('/whatsapp/send', validateExternalApiKey, externalController.sendWhatsApp);
router.post('/order/create', validateExternalApiKey, externalController.createOrder);
router.post('/customer/create', validateExternalApiKey, externalController.createCustomer);

module.exports = router;
