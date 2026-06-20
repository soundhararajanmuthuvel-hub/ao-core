import client from './client';

export const authApi = {
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
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
};

export const analyticsApi = {
  dashboard: () => client.get('/analytics/dashboard'),
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
  chat: (data) => client.post('/ai/chat', data),
};

export const integrationsApi = {
  testConnection: () => client.post('/integrations/test-connection'),
  connect: (data) => client.post('/integrations/connect', data),
  syncProducts: () => client.post('/integrations/sync/products'),
  importProducts: () => client.post('/integrations/sync/products-import'),
  syncCustomers: () => client.post('/integrations/sync/customers'),
  syncOrders: () => client.post('/integrations/sync/orders'),
  syncInventory: () => client.post('/integrations/sync/inventory'),
  syncAll: () => client.post('/integrations/sync/all'),
  forceRefreshWooProduct: (id) => client.post(`/integrations/sync/product/${id}`),
  getStats: () => client.get('/integrations/stats'),
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
};


