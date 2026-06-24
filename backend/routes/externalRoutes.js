const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const externalController = require('../controllers/externalController');
const {
  validateApiKey,
  ipWhitelist,
  rateLimit,
  checkPermission,
  auditAccess
} = require('../middleware/apiGateway');

// Composite security stack for API Key routes
const gatewayStack = [validateApiKey, ipWhitelist, rateLimit, auditAccess];

// ==========================================
// DEVELOPER PORTAL ADMINISTRATION (Admin role - JWT Auth)
// ==========================================
router.post('/credentials', auth, authorize('admin', 'Super Admin'), externalController.createExportCredential);
router.get('/credentials', auth, authorize('admin', 'Super Admin'), externalController.listExportCredentials);
router.delete('/credentials/:id', auth, authorize('admin', 'Super Admin'), externalController.deleteExportCredential);
router.post('/credentials/:id/regenerate', auth, authorize('admin', 'Super Admin'), externalController.regenerateExportCredential);

// Developer Portal Live Analytics & Audits
router.get('/analytics/dashboard', auth, authorize('admin', 'Super Admin'), externalController.getAnalyticsDashboard);
router.get('/audit-logs', auth, authorize('admin', 'Super Admin'), externalController.getAuditLogs);

// ==========================================
// PUBLIC HEALTH CHECK FOR SAAS / EXTERNAL LINKS
// ==========================================
router.get('/health', externalController.getHealth);

// ==========================================
// SECURE EXTERNAL DATA ENDPOINTS (API Key authenticated)
// ==========================================

// --- PRODUCTS ---
router.get('/products', gatewayStack, checkPermission('Products', 'Read'), externalController.getProducts);
router.post('/products', gatewayStack, checkPermission('Products', 'Create'), externalController.createProduct);
router.put('/products/:id', gatewayStack, checkPermission('Products', 'Update'), externalController.updateProduct);
router.delete('/products/:id', gatewayStack, checkPermission('Products', 'Delete'), externalController.deleteProduct);

// --- CUSTOMERS ---
router.get('/customers', gatewayStack, checkPermission('Customers', 'Read'), externalController.getCustomers);
router.post('/customers', gatewayStack, checkPermission('Customers', 'Create'), externalController.createCustomer);
router.put('/customers/:id', gatewayStack, checkPermission('Customers', 'Update'), externalController.updateCustomer);
router.delete('/customers/:id', gatewayStack, checkPermission('Customers', 'Delete'), externalController.deleteCustomer);

// --- ORDERS ---
router.get('/orders', gatewayStack, checkPermission('Orders', 'Read'), externalController.getOrders);
router.post('/orders', gatewayStack, checkPermission('Orders', 'Create'), externalController.createOrder);
router.put('/orders/:id', gatewayStack, checkPermission('Orders', 'Update'), externalController.updateOrder);
router.delete('/orders/:id', gatewayStack, checkPermission('Orders', 'Delete'), externalController.deleteOrder);

// --- INVOICES ---
router.get('/invoices', gatewayStack, checkPermission('Invoices', 'Read'), externalController.getInvoices);
router.post('/invoices', gatewayStack, checkPermission('Invoices', 'Create'), externalController.createInvoice);
router.put('/invoices/:id', gatewayStack, checkPermission('Invoices', 'Update'), externalController.updateInvoice);
router.delete('/invoices/:id', gatewayStack, checkPermission('Invoices', 'Delete'), externalController.deleteInvoice);

// --- INVENTORY ---
router.get('/inventory', gatewayStack, checkPermission('Inventory', 'Read'), externalController.getInventory);
router.post('/inventory/adjust', gatewayStack, checkPermission('Inventory', 'Create'), externalController.adjustInventory);

// --- PURCHASES ---
router.get('/purchases', gatewayStack, checkPermission('Purchases', 'Read'), externalController.getPurchases);
router.post('/purchases', gatewayStack, checkPermission('Purchases', 'Create'), externalController.createPurchase);
router.put('/purchases/:id', gatewayStack, checkPermission('Purchases', 'Update'), externalController.updatePurchase);
router.delete('/purchases/:id', gatewayStack, checkPermission('Purchases', 'Delete'), externalController.deletePurchase);

// --- MANUFACTURING ---
router.get('/manufacturing', gatewayStack, checkPermission('Manufacturing', 'Read'), externalController.getManufacturing);
router.post('/manufacturing', gatewayStack, checkPermission('Manufacturing', 'Create'), externalController.createManufacturing);
router.put('/manufacturing/:id', gatewayStack, checkPermission('Manufacturing', 'Update'), externalController.updateManufacturing);
router.delete('/manufacturing/:id', gatewayStack, checkPermission('Manufacturing', 'Delete'), externalController.deleteManufacturing);

// --- SUPPLIERS ---
router.get('/suppliers', gatewayStack, checkPermission('Suppliers', 'Read'), externalController.getSuppliers);
router.post('/suppliers', gatewayStack, checkPermission('Suppliers', 'Create'), externalController.createSupplier);
router.put('/suppliers/:id', gatewayStack, checkPermission('Suppliers', 'Update'), externalController.updateSupplier);
router.delete('/suppliers/:id', gatewayStack, checkPermission('Suppliers', 'Delete'), externalController.deleteSupplier);

// --- REPORTS & ANALYTICS ---
router.get('/reports', gatewayStack, checkPermission('Reports', 'Read'), externalController.getReports);
router.get('/analytics', gatewayStack, checkPermission('Analytics', 'Read'), externalController.getAnalytics);
router.get('/settings', gatewayStack, checkPermission('Settings', 'Read'), externalController.getSettings);

// --- OUTSTANDING & CATALOGUES (CRM/Catalogues mapping) ---
router.get('/outstanding', gatewayStack, checkPermission('Invoices', 'Read'), externalController.getOutstanding);
router.get('/catalogues', gatewayStack, checkPermission('Products', 'Read'), externalController.getCatalogues);

// --- WHATSAPP COMMERCE INTEGRATION ---
router.post('/whatsapp/send', gatewayStack, checkPermission('CRM', 'Create'), externalController.sendWhatsApp);

// --- WEBHOOK ENDPOINTS ---
router.get('/webhooks/endpoints', gatewayStack, checkPermission('Settings', 'Read'), externalController.listWebhookEndpoints);
router.post('/webhooks/endpoints', gatewayStack, checkPermission('Settings', 'Create'), externalController.createWebhookEndpoint);
router.put('/webhooks/endpoints/:id', gatewayStack, checkPermission('Settings', 'Update'), externalController.updateWebhookEndpoint);
router.delete('/webhooks/endpoints/:id', gatewayStack, checkPermission('Settings', 'Delete'), externalController.deleteWebhookEndpoint);

// Webhook Delivery Logs
router.get('/webhooks/logs', gatewayStack, checkPermission('Settings', 'Read'), externalController.listWebhookLogs);
router.post('/webhooks/logs/:id/retry', gatewayStack, checkPermission('Settings', 'Update'), externalController.retryWebhookLog);

// --- AI DATA LAYER ENDPOINTS ---
const aiController = require('../controllers/aiController');
router.get('/ai/customer-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getCustomerInsights);
router.get('/ai/product-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getProductInsights);
router.get('/ai/sales-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getSalesInsights);
router.get('/ai/inventory-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getInventoryInsights);
router.get('/ai/manufacturing-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getManufacturingInsights);
router.get('/ai/crm-insights', gatewayStack, checkPermission('Analytics', 'Read'), aiController.getCrmInsights);

module.exports = router;
