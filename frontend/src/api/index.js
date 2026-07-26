import client from './client';

export const authApi = {
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
  updateTour: (tourCompleted) => client.put('/auth/me/tour', { tourCompleted }),
  changePassword: (password) => client.put('/auth/me/change-password', { password }),
};

export const usersApi = {
  list: (params) => client.get('/users', { params }),
  create: (data) => client.post('/users', data),
  update: (id, data) => client.put(`/users/${id}`, data),
  remove: (id) => client.delete(`/users/${id}`),
};

export const productsApi = {
  list: (params) => client.get('/products', { params }),
  lowStock: () => client.get('/products/low-stock'),
  categories: () => client.get('/products/categories'),
  get: (id) => client.get(`/products/${id}`),
  history: (id) => client.get(`/products/${id}/history`),
  create: (data) => client.post('/products', data),
  update: (id, data) => client.put(`/products/${id}`, data),
  remove: (id, mode = 'erp_only') => client.delete(`/products/${id}`, { data: { mode } }),
  restore: (id) => client.post(`/products/${id}/restore`),
  removePermanent: (id) => client.delete(`/products/${id}/permanent`),
  dependencies: (id) => client.get(`/products/${id}/dependencies`),
  adjustZero: (id) => client.post(`/products/${id}/adjust-zero`),
};

export const customersApi = {
  list: (params) => client.get('/customers', { params }),
  get: (id) => client.get(`/customers/${id}`),
  profile: (id) => client.get(`/customers/${id}/profile`),
  sales: (id) => client.get(`/customers/${id}/sales`),

  payments: (id) => client.get(`/customers/${id}/payments`),
  create: (data) => client.post('/customers', data),
  update: (id, data) => client.put(`/customers/${id}`, data),
  remove: (id) => client.delete(`/customers/${id}`),
  dependencies: (id) => client.get(`/customers/${id}/dependencies`),
  archive: (id) => client.put(`/customers/${id}/archive`),
  restore: (id) => client.put(`/customers/${id}/restore`),
  getNotes: (id) => client.get(`/customers/${id}/notes`),
  createNote: (id, data) => client.post(`/customers/${id}/notes`, data),
  getFollowUps: (id) => client.get(`/customers/${id}/followups`),
  createFollowUp: (id, data) => client.post(`/customers/${id}/followups`, data),
  updateFollowUp: (id, followUpId, data) => client.put(`/customers/${id}/followups/${followUpId}`, data),
  getReminders: (id) => client.get(`/customers/${id}/reminders`),
  createReminder: (id, data) => client.post(`/customers/${id}/reminders`, data),
};

export const salesTargetsApi = {
  list: () => client.get('/sales-targets'),
  create: (data) => client.post('/sales-targets', data),
  update: (id, data) => client.put(`/sales-targets/${id}`, data),
  remove: (id) => client.delete(`/sales-targets/${id}`),
  dashboard: () => client.get('/sales-targets/dashboard'),
  getSalesmanDashboard: () => client.get('/salesman/dashboard'),
};

export const salesApi = {
  list: (params) => client.get('/sales', { params }),
  get: (id) => client.get(`/sales/${id}`),
  create: (data) => client.post('/sales', data),
  remove: (id) => client.delete(`/sales/${id}`),
  outstanding: (params) => client.get('/sales/outstanding', { params }),
  getWhatsAppReminder: (id) => client.get(`/sales/${id}/whatsapp-reminder`),
  recordPayment: (data) => client.post('/sales/payment', data),
  listPayments: (params) => client.get('/sales/payments', { params }),
  reconcile: () => client.post('/sales/reconcile'),
  update: (id, data) => client.put(`/sales/${id}`, data),
  updatePayment: (id, data) => client.put(`/sales/payment/${id}`, data),
  deletePayment: (id) => client.delete(`/sales/payment/${id}`),
};

export const purchasesApi = {
  list: (params) => client.get('/purchases', { params }),
  create: (data) => client.post('/purchases', data),
  remove: (id) => client.delete(`/purchases/${id}`),
  suggestions: () => client.get('/purchases/suggestions'),
  ignoreSuggestion: (key) => client.post('/purchases/suggestions/ignore', { key }),
};

export const suppliersApi = {
  list: (params) => client.get('/suppliers', { params }),
  create: (data) => client.post('/suppliers', data),
  update: (id, data) => client.put(`/suppliers/${id}`, data),
  remove: (id) => client.delete(`/suppliers/${id}`),
  dashboard: () => client.get('/suppliers/dashboard'),
  purchases: () => client.get('/suppliers/purchases'),
  pay: (id, type) => client.put(`/suppliers/purchases/${id}/pay`, { type }),
};

export const inventoryApi = {
  movements: (params) => client.get('/inventory/movements', { params }),
  report: () => client.get('/inventory/report'),
  adjust: (data) => client.post('/inventory/adjust', data),
  repack: (data) => client.post('/inventory/repack', data),
  manufacturing: (data) => client.post('/inventory/manufacturing', data),
  lowStockAlerts: () => client.get('/inventory/low-stock-alerts'),
  getProductBatches: (id) => client.get(`/inventory/products/${id}/batches`),
  getLossRegister: () => client.get('/inventory/loss'),
  createLoss: (data) => client.post('/inventory/loss', data),
  getLossDashboard: () => client.get('/inventory/loss/dashboard'),
};

export const settingsApi = {
  get: () => client.get('/settings'),
  update: (data) => client.put('/settings', data),
  uploadLogo: (formData) => client.post('/settings/logo', formData),
  uploadWpLogo: (formData) => client.post('/settings/upload-wp-logo', formData),
  getLogo: () => client.get('/settings/logo'),
};

export const analyticsApi = {
  dashboard: () => client.get('/analytics/dashboard'),
  getHomeDashboard: () => client.get('/dashboard/home'),
};

export const reportsApi = {
  sales: (params) => client.get('/reports/sales', { params }),
  purchases: (params) => client.get('/reports/purchases', { params }),
  gstPurchaseRegister: (params) => client.get('/reports/gst/purchase-register', { params }),
  exportGstPurchaseRegisterExcel: (params) => client.get('/reports/gst/purchase-register', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportGstPurchaseRegisterCsv: (params) => client.get('/reports/gst/purchase-register', { params: { ...params, export: 'csv' }, responseType: 'blob' }),
  gstItc: (params) => client.get('/reports/gst/itc', { params }),
  gstAnalytics: (params) => client.get('/reports/gst/analytics', { params }),
  gstMonthly: (params) => client.get('/reports/gst/monthly', { params }),
  gstReconciliation: (params) => client.get('/reports/gst/reconciliation', { params }),
  daily: (params) => client.get('/reports/daily', { params }),
  shipping: (params) => client.get('/reports/shipping', { params }),
  exportSales: (params) => client.get('/reports/sales', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportPurchases: (params) => client.get('/reports/purchases', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportShipping: (params) => client.get('/reports/shipping', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  shippingCosts: (params) => client.get('/reports/shipping-costs', { params }),
  exportShippingCosts: (params) => client.get('/reports/shipping-costs', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  procurementReport: (type, params) => client.get(`/reports/procurement/${type}`, { params }),
  exportProcurementReport: (type, params) => client.get(`/reports/procurement/${type}`, { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  gstGstr1: (params) => client.get('/reports/gst/gstr-1', { params }),
  exportGstGstr1Excel: (params) => client.get('/reports/gst/gstr-1', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportGstGstr1Csv: (params) => client.get('/reports/gst/gstr-1', { params: { ...params, export: 'csv' }, responseType: 'blob' }),
  gstB2b: (params) => client.get('/reports/gst/b2b', { params }),
  exportGstB2bExcel: (params) => client.get('/reports/gst/b2b', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  gstB2c: (params) => client.get('/reports/gst/b2c', { params }),
  exportGstB2cExcel: (params) => client.get('/reports/gst/b2c', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  gstHsn: (params) => client.get('/reports/gst/hsn-summary', { params }),
  exportGstHsnExcel: (params) => client.get('/reports/gst/hsn-summary', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  gstSalesRegister: (params) => client.get('/reports/gst/sales-register', { params }),
  exportGstSalesRegisterExcel: (params) => client.get('/reports/gst/sales-register', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  gstSummary: (params) => client.get('/reports/gst/summary', { params }),
  bulkStock: (params) => client.get('/reports/bulk-stock', { params }),
  packingConversion: (params) => client.get('/reports/packing-conversion', { params }),
  variantStock: (params) => client.get('/reports/variant-stock', { params }),
  mfgYield: (params) => client.get('/reports/mfg-yield', { params }),
};

export const notificationsApi = {
  list: (params) => client.get('/notifications', { params }),
  markRead: (id, isRead = true) => client.patch(`/notifications/${id}/read`, { isRead }),
  markAllRead: () => client.patch('/notifications/read-all'),
  remove: (id) => client.delete(`/notifications/${id}`),
  clearAll: () => client.delete('/notifications'),
};

export const activityApi = {
  list: (params) => client.get('/activity', { params }),
};

export const searchApi = {
  global: (q) => client.get('/search', { params: { q } }),
};

export const repackApi = {
  listRecipes: () => client.get('/repack/recipes'),
  getRecipe: (id) => client.get(`/repack/recipes/${id}`),
  createRecipe: (data) => client.post('/repack/recipes', data),
  updateRecipe: (id, data) => client.put(`/repack/recipes/${id}`, data),
  removeRecipe: (id) => client.delete(`/repack/recipes/${id}`),
  list: () => client.get('/repack'),
  get: (id) => client.get(`/repack/${id}`),
  create: (data) => client.post('/repack', data),
  update: (id, data) => client.put(`/repack/${id}`, data),
  remove: (id) => client.delete(`/repack/${id}`),
  report: () => client.get('/repack/report'),
};

export const rawMaterialsApi = {
  list: (params) => client.get('/raw-materials', { params }),
  create: (data) => client.post('/raw-materials', data),
  update: (id, data) => client.put(`/raw-materials/${id}`, data),
  remove: (id) => client.delete(`/raw-materials/${id}`),
  purchase: (data) => client.post('/raw-materials/purchase', data),
  adjust: (data) => client.post('/raw-materials/adjust', data),
  movements: (params) => client.get('/raw-materials/movements', { params }),
  report: () => client.get('/raw-materials/report'),
};

export const manufacturingApi = {
  listRecipes: () => client.get('/manufacturing/recipes'),
  createRecipe: (data) => client.post('/manufacturing/recipes', data),
  updateRecipe: (id, data) => client.put(`/manufacturing/recipes/${id}`, data),
  removeRecipe: (id) => client.delete(`/manufacturing/recipes/${id}`),
  list: () => client.get('/manufacturing/entries'),
  create: (data) => client.post('/manufacturing/entries', data),
  update: (id, data) => client.put(`/manufacturing/entries/${id}`, data),
  reverse: (id) => client.post(`/manufacturing/entries/${id}/reverse`),
  planner: () => client.get('/manufacturing/planner'),
  dashboard: () => client.get('/manufacturing/dashboard'),
};

export const packingConversionApi = {
  list: () => client.get('/packing-conversion'),
  create: (data) => client.post('/packing-conversion', data),
  reverse: (id) => client.post(`/packing-conversion/${id}/reverse`),
};

export const shippingApi = {
  list: (params) => client.get('/shipping', { params }),
  get: (id) => client.get(`/shipping/${id}`),
  create: (data) => client.post('/shipping', data),
  updateStatus: (id, data) => client.put(`/shipping/${id}/status`, data),
  notify: (id, data) => client.post(`/shipping/${id}/notify`, data),
  remove: (id) => client.delete(`/shipping/${id}`),
  getAnalytics: () => client.get('/shipping/analytics/dashboard'),
  publicTrack: (trackingNumber) => client.get(`/shipping/public/track/${trackingNumber}`),
};

export const courierApi = {
  list: () => client.get('/couriers'),
  create: (data) => client.post('/couriers', data),
  update: (id, data) => client.put(`/couriers/${id}`, data),
  remove: (id) => client.delete(`/couriers/${id}`),
};

export const aiApi = {
  insights: () => client.get('/ai/insights'),
  suggestions: (params) => client.get('/ai/suggestions', { params }),
  chat: (data) => client.post('/ai/chat', data),
  analyzeLeads: () => client.post('/ai/analyze-leads'),
  customerIntelligence: () => client.post('/ai/customer-intelligence'),
  salesAssistant: (data) => client.post('/ai/sales-assistant', data),
  inventoryIntelligence: () => client.post('/ai/inventory-intelligence'),
  accountsAssistant: () => client.post('/ai/accounts-assistant'),
  manufacturingAssistant: () => client.post('/ai/manufacturing-assistant'),
};

export const integrationsApi = {
  list: () => client.get('/integrations'),
  create: (data) => client.post('/integrations', data),
  update: (id, data) => client.put(`/integrations/${id}`, data),
  remove: (id) => client.delete(`/integrations/${id}`),
  testConnection: (data) => client.post('/integrations/test', data),
  sync: (data) => client.post('/integrations/sync', data),
  getLogs: (params) => client.get('/integrations/logs', { params }),
  getMappings: (params) => client.get('/integrations/mappings', { params }),
  saveMappings: (data) => client.post('/integrations/mappings', data),
  getStats: () => client.get('/integrations/stats'),
  
  // Developer Exports Credentials Admin
  getCredentials: () => client.get('/external/credentials'),
  createCredential: (data) => client.post('/external/credentials', data),
  deleteCredential: (id) => client.delete(`/external/credentials/${id}`),
  regenerateCredential: (id) => client.post(`/external/credentials/${id}/regenerate`),
  
  // Legacy WooCommerce endpoints (kept for compatibility)
  testWooConnection: () => client.post('/integrations/test-connection'),
  connect: (data) => client.post('/integrations/connect', data),
  syncProducts: () => client.post('/integrations/sync/products'),
  importProducts: () => client.post('/integrations/sync/products-import'),
  syncCustomers: () => client.post('/integrations/sync/customers'),
  syncOrders: () => client.post('/integrations/sync/orders'),
  syncInventory: () => client.post('/integrations/sync/inventory'),
  syncAll: () => client.post('/integrations/sync/all'),
  forceRefreshWooProduct: (id) => client.post(`/integrations/sync/product/${id}`),
  getWooStats: () => client.get('/integrations/woo-stats'),
  disconnect: () => client.post('/integrations/disconnect'),
  getSyncLogs: (params) => client.get('/integrations/sync-logs', { params }),
};

export const ordersApi = {
  list: (params) => client.get('/orders', { params }),
  get: (id) => client.get(`/orders/${id}`),
  create: (data) => client.post('/orders', data),
  update: (id, data) => client.put(`/orders/${id}`, data),
  remove: (id) => client.delete(`/orders/${id}`),
  markPacked: (id) => client.post(`/orders/${id}/mark-packed`),
  markDispatched: (id, data) => client.post(`/orders/${id}/mark-dispatched`, data),
  markDelivered: (id, data) => client.post(`/orders/${id}/mark-delivered`, data),
  dashboard: () => client.get('/orders/dashboard'),
};

export const migrationApi = {
  upload: (formData) => client.post('/migration/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  execute: (data) => client.post('/migration/execute', data),
  history: () => client.get('/migration/history'),
  logs: (id) => client.get(`/migration/logs/${id}`),
  rollback: (id) => client.post(`/migration/rollback/${id}`),
  exportUrl: () => `${client.defaults.baseURL}/migration/export`,
  exportBackup: () => client.get('/migration/export', { responseType: 'blob' }),
  restore: (formData) => client.post('/migration/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const sfaApi = {
  getRoutes: (params) => client.get('/sfa/routes', { params }),
  createRoute: (data) => client.post('/sfa/routes', data),
  updateRoute: (id, data) => client.put(`/sfa/routes/${id}`, data),
  optimizeRoute: (data) => client.post('/sfa/routes/optimize', data),
  checkIn: (data) => client.post('/sfa/visits/check-in', data),
  checkOut: (data) => client.post('/sfa/visits/check-out', data),
  logManualVisit: (data) => client.post('/sfa/visits/manual', data),
  getVisits: (params) => client.get('/sfa/visits', { params }),
  pingLocation: (data) => client.post('/sfa/tracking/ping', data),
  getLiveTracking: () => client.get('/sfa/tracking/live'),
  getTrackingHistory: (salesmanId, date) => client.get(`/sfa/tracking/history/${salesmanId}/${date}`),
  getReviewDetails: (token) => client.get(`/sfa/reviews/portal/${token}`),
  submitReview: (token, data) => client.post(`/sfa/reviews/portal/${token}`, data),
  getAnalytics: (params) => client.get('/sfa/analytics', { params }),
};

export const crmApi = {
  getDashboard: () => client.get('/crm/dashboard'),
  getLeads: (params) => client.get('/crm/leads', { params }),
  getLead: (id) => client.get(`/crm/leads/${id}`),
  createLead: (data) => client.post('/crm/leads', data),
  updateLead: (id, data) => client.put(`/crm/leads/${id}`, data),
  deleteLead: (id) => client.delete(`/crm/leads/${id}`),
  findLeads: (params) => client.get('/crm/lead-finder', { params }),
  convertLead: (id, data) => client.post(`/crm/leads/${id}/convert`, data),
  
  extractText: (formData) => client.post('/crm/leads/import/extract-text', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  analyzeLeadsText: (data) => client.post('/crm/leads/import/analyze', data),
  importLeadsList: (data) => client.post('/crm/leads/import/execute', data),
  
  getOpportunities: (params) => client.get('/crm/opportunities', { params }),
  createOpportunity: (data) => client.post('/crm/opportunities', data),
  updateOpportunity: (id, data) => client.put(`/crm/opportunities/${id}`, data),
  deleteOpportunity: (id) => client.delete(`/crm/opportunities/${id}`),
  
  getFollowUps: (params) => client.get('/crm/followups', { params }),
  createFollowUp: (data) => client.post('/crm/followups', data),
  updateFollowUp: (id, data) => client.put(`/crm/followups/${id}`, data),
  deleteFollowUp: (id) => client.delete(`/crm/followups/${id}`),

  getReviews: (params) => client.get('/crm/reviews', { params }),
  sendReviewLink: (data) => client.post('/crm/reviews/send', data),
  getReEngagementDashboard: () => client.get('/crm/re-engagement/dashboard'),
  getReEngagementCustomers: (params) => client.get('/crm/re-engagement/customers', { params }),
  triggerAutoFollowUps: () => client.post('/crm/re-engagement/create-tasks'),
  getReEngagementAiInsights: (params) => client.get('/crm/re-engagement/ai-insights', { params }),
};

export const whatsappApi = {
  getSettings: () => client.get('/whatsapp/settings'),
  updateSettings: (data) => client.put('/whatsapp/settings', data),
  testConnection: () => client.post('/whatsapp/settings/test'),
  sendPdf: (formData) => client.post('/whatsapp/send-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  sendText: (data) => client.post('/whatsapp/send-text', data),
  sendDocument: (data) => client.post('/whatsapp/send-document', data),
  getLogs: (params) => client.get('/whatsapp/logs', { params }),
  getStats: () => client.get('/whatsapp/stats'),
  sendTestMessage: () => client.post('/whatsapp/settings/test-message'),
  sendTestCatalogue: () => client.post('/whatsapp/settings/test-catalogue'),
  sendTestInvoice: () => client.post('/whatsapp/settings/test-invoice'),
  retryFailedLogs: () => client.post('/whatsapp/logs/retry-failed')
};

export const databaseApi = {
  getCounts: () => client.get('/settings/database/counts'),
  verifyPassword: (password) => client.post('/settings/database/verify-password', { password }),
  resetDemoData: (password, includeUsers) => client.post('/settings/database/reset-demo', { password, includeUsers }),
  clearTransactions: (password, includeUsers) => client.post('/settings/database/clear-transactions', { password, includeUsers }),
  factoryReset: (password) => client.post('/settings/database/factory-reset', { password }),
  backup: () => client.get('/settings/database/backup', { responseType: 'blob' }),
};

export const catalogApi = {
  getPublicCatalog: () => client.get('/catalog/public'),
  downloadPdf: (params) => client.get('/catalog/download/pdf', { params, responseType: 'blob' }),
  downloadImage: (productId, params) => client.get(`/catalog/download/image/${productId}`, { params, responseType: 'blob' }),
  shareWhatsApp: (data) => client.post('/catalog/share/whatsapp', data),
};

export const developerApi = {
  getAnalytics: () => client.get('/external/analytics/dashboard'),
  getAuditLogs: (params) => client.get('/external/audit-logs', { params }),
  
  // Webhook settings CRUD
  listWebhookEndpoints: () => client.get('/external/webhooks/endpoints'),
  createWebhookEndpoint: (data) => client.post('/external/webhooks/endpoints', data),
  updateWebhookEndpoint: (id, data) => client.put(`/external/webhooks/endpoints/${id}`, data),
  deleteWebhookEndpoint: (id) => client.delete(`/external/webhooks/endpoints/${id}`),
  
  // Webhook Logs
  listWebhookLogs: (params) => client.get('/external/webhooks/logs', { params }),
  retryWebhookLog: (id) => client.post(`/external/webhooks/logs/${id}/retry`),

  // AI insights dashboard calls
  getCustomerInsights: () => client.get('/ai/customer-insights'),
  getProductInsights: () => client.get('/ai/product-insights'),
  getSalesInsights: () => client.get('/ai/sales-insights'),
  getInventoryInsights: () => client.get('/ai/inventory-insights'),
  getManufacturingInsights: () => client.get('/ai/manufacturing-insights'),
  getCrmInsights: () => client.get('/ai/crm-insights'),
};

export const returnsApi = {
  list: (params) => client.get('/returns', { params }),
  create: (data) => client.post('/returns', data),
  get: (id) => client.get(`/returns/${id}`),
  approve: (id) => client.put(`/returns/${id}/approve`),
  qcInspect: (id, data) => client.post(`/returns/${id}/qc-inspect`, data),
  close: (id) => client.put(`/returns/${id}/close`),
  scanLookup: (barcode) => client.post('/returns/scan-lookup', { barcode }),
  getDashboardMetrics: () => client.get('/returns/analytics/dashboard'),
  getAiInsights: () => client.get('/returns/ai/insights'),
};




