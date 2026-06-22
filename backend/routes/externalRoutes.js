const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const externalAuth = require('../middleware/externalAuth');
const externalController = require('../controllers/externalController');

// ==========================================
// DEVELOPER CREDENTIALS ADMINISTRATION (Admin role)
// ==========================================
router.post('/credentials', auth, authorize('admin'), externalController.createExportCredential);
router.get('/credentials', auth, authorize('admin'), externalController.listExportCredentials);
router.delete('/credentials/:id', auth, authorize('admin'), externalController.deleteExportCredential);
router.post('/credentials/:id/regenerate', auth, authorize('admin'), externalController.regenerateExportCredential);

// ==========================================
// SECURE EXTERNAL DATA EXPORTS (API Key authenticated)
// ==========================================
router.get('/products', externalAuth, externalController.getProducts);
router.get('/customers', externalAuth, externalController.getCustomers);
router.get('/orders', externalAuth, externalController.getOrders);
router.get('/invoices', externalAuth, externalController.getInvoices);
router.get('/catalogues', externalAuth, externalController.getCatalogues);
router.get('/outstanding', externalAuth, externalController.getOutstanding);
router.get('/reports', externalAuth, externalController.getReports);
router.get('/settings', externalAuth, externalController.getSettings);
router.post('/whatsapp/send', externalAuth, externalController.sendWhatsApp);
router.post('/order/create', externalAuth, externalController.createOrder);
router.post('/customer/create', externalAuth, externalController.createCustomer);

module.exports = router;
