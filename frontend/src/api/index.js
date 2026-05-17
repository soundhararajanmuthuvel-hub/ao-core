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
  create: (data) => client.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => client.put(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => client.delete(`/products/${id}`),
};

export const customersApi = {
  list: (params) => client.get('/customers', { params }),
  get: (id) => client.get(`/customers/${id}`),
  sales: (id) => client.get(`/customers/${id}/sales`),
  create: (data) => client.post('/customers', data),
  update: (id, data) => client.put(`/customers/${id}`, data),
  remove: (id) => client.delete(`/customers/${id}`),
};

export const salesApi = {
  list: (params) => client.get('/sales', { params }),
  get: (id) => client.get(`/sales/${id}`),
  create: (data) => client.post('/sales', data),
  remove: (id) => client.delete(`/sales/${id}`),
};

export const purchasesApi = {
  list: (params) => client.get('/purchases', { params }),
  create: (data) => client.post('/purchases', data),
  remove: (id) => client.delete(`/purchases/${id}`),
};

export const suppliersApi = {
  list: (params) => client.get('/suppliers', { params }),
  create: (data) => client.post('/suppliers', data),
  update: (id, data) => client.put(`/suppliers/${id}`, data),
  remove: (id) => client.delete(`/suppliers/${id}`),
};

export const inventoryApi = {
  movements: (params) => client.get('/inventory/movements', { params }),
  report: () => client.get('/inventory/report'),
  adjust: (data) => client.post('/inventory/adjust', data),
  repack: (data) => client.post('/inventory/repack', data),
  manufacturing: (data) => client.post('/inventory/manufacturing', data),
};

export const settingsApi = {
  get: () => client.get('/settings'),
  update: (data) => client.put('/settings', data),
  uploadLogo: (formData) => client.post('/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const analyticsApi = {
  dashboard: () => client.get('/analytics/dashboard'),
};

export const reportsApi = {
  sales: (params) => client.get('/reports/sales', { params }),
  purchases: (params) => client.get('/reports/purchases', { params }),
  daily: (params) => client.get('/reports/daily', { params }),
  exportSales: (params) => client.get('/reports/sales', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportPurchases: (params) => client.get('/reports/purchases', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
  exportDaily: (params) => client.get('/reports/daily', { params: { ...params, export: 'excel' }, responseType: 'blob' }),
};

export const notificationsApi = {
  list: () => client.get('/notifications'),
  markRead: (id) => client.patch(`/notifications/${id}/read`),
  markAllRead: () => client.patch('/notifications/read-all'),
};

export const activityApi = {
  list: (params) => client.get('/activity', { params }),
};

export const searchApi = {
  global: (q) => client.get('/search', { params: { q } }),
};
