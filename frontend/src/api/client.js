import axios from 'axios';
import { API_BASE_URL } from '../utils/url';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
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
    }
    return res;
  },
  (err) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ao-loading-end', {
        detail: { url: err.config?.url || '', success: false, error: err }
      }));
    }
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
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
