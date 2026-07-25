import axios from 'axios';
import { API_BASE_URL } from '../utils/url';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (typeof config.headers?.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
      config.headers.delete('content-type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ao-loading-start', {
      detail: {
        url: config.url || '',
        method: config.method || 'get',
        data: config.data
      }
    }));
  }

  return config;
});

client.interceptors.response.use(
  (res) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ao-loading-end', {
        detail: { url: res.config?.url || '', success: true }
      }));

      // Cache successful GET requests for offline usage (Step 6)
      if (res.config?.method?.toLowerCase() === 'get') {
        const url = res.config.url || '';
        try {
          if (url.includes('/products') && !url.includes('/low-stock') && !url.includes('/categories') && !url.includes('/history') && !url.includes('/dependencies')) {
            localStorage.setItem('offline_data_products', JSON.stringify(res.data));
          } else if (url.includes('/customers') && !url.includes('/sales') && !url.includes('/payments') && !url.includes('/notes') && !url.includes('/followups') && !url.includes('/reminders') && !url.includes('/dependencies')) {
            localStorage.setItem('offline_data_customers', JSON.stringify(res.data));
          } else if (url.includes('/sales') && !url.includes('/outstanding') && !url.includes('/whatsapp-reminder') && !url.includes('/payments')) {
            localStorage.setItem('offline_data_sales', JSON.stringify(res.data));
          } else if (url.includes('/settings')) {
            localStorage.setItem('offline_data_settings', JSON.stringify(res.data));
          }
        } catch (cacheErr) {
          console.warn('[PWA] Failed to cache offline data:', cacheErr);
        }
      }
    }
    return res;
  },
  async (err) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ao-loading-end', {
        detail: { url: err.config?.url || '', success: false, error: err }
      }));

      const isNetworkError = !err.response;
      const isOffline = !navigator.onLine;
      const isOfflineMode = sessionStorage.getItem('offline_mode') === 'true';

      // Transparent offline fallback for GET requests (Step 6)
      if ((isNetworkError || isOffline || isOfflineMode) && err.config?.method?.toLowerCase() === 'get') {
        const url = err.config.url || '';
        let cachedData = null;
        try {
          if (url.includes('/products') && !url.includes('/low-stock') && !url.includes('/categories') && !url.includes('/history') && !url.includes('/dependencies')) {
            cachedData = localStorage.getItem('offline_data_products');
          } else if (url.includes('/customers') && !url.includes('/sales') && !url.includes('/payments') && !url.includes('/notes') && !url.includes('/followups') && !url.includes('/reminders') && !url.includes('/dependencies')) {
            cachedData = localStorage.getItem('offline_data_customers');
          } else if (url.includes('/sales') && !url.includes('/outstanding') && !url.includes('/whatsapp-reminder') && !url.includes('/payments')) {
            cachedData = localStorage.getItem('offline_data_sales');
          } else if (url.includes('/settings')) {
            cachedData = localStorage.getItem('offline_data_settings');
          }

          if (cachedData) {
            console.log(`[PWA] Serving offline cached data for GET: ${url}`);
            return Promise.resolve({
              data: JSON.parse(cachedData),
              status: 200,
              statusText: 'OK',
              headers: {},
              config: err.config,
              request: {}
            });
          }
        } catch (cacheErr) {
          console.warn('[PWA] Error reading offline cache:', cacheErr);
        }
      }

      if (isNetworkError && !isOfflineMode) {
        window.dispatchEvent(new CustomEvent('ao-connection-error', {
          detail: { error: err }
        }));
      }
    }
    
    // Audit Axios interceptor: ONLY redirect to /login if 401 is explicitly returned by an ERP User Authentication endpoint or contains explicit auth error payload
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/') || url.includes('/users/me');
    const isUploadEndpoint = url.includes('/upload') || (typeof FormData !== 'undefined' && err.config?.data instanceof FormData);
    const resMsg = err.response?.data?.message || err.response?.data?.error || '';
    const isAuthFailureMsg = resMsg === 'Not authorized' || resMsg === 'User not found or inactive' || resMsg === 'Invalid token';

    if (err.response?.status === 401 && !isUploadEndpoint && (isAuthEndpoint || isAuthFailureMsg)) {
      console.warn('[Axios Interceptor] ERP User Session Expired (401). Redirecting to /login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);


export default client;
