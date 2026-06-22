const axios = require('axios');
const { decryptCredential } = require('../utils/encryption');

async function createClient(connection) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const username = connection.username;
  const password = connection.password ? decryptCredential(connection.password) : null;
  const apiKey = connection.apiKey ? decryptCredential(connection.apiKey) : null;
  const apiSecret = connection.apiSecret ? decryptCredential(connection.apiSecret) : null;
  const bearerToken = connection.bearerToken ? decryptCredential(connection.bearerToken) : null;

  // Custom HTTP Auth Bindings
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else if (apiKey && apiSecret) {
    headers['X-API-KEY'] = apiKey;
    headers['X-API-SECRET'] = apiSecret;
    headers['Authorization'] = `KeySecret ${apiKey}:${apiSecret}`;
  } else if (apiKey) {
    headers['X-API-KEY'] = apiKey;
    headers['Authorization'] = `ApiKey ${apiKey}`;
  } else if (username && password) {
    const authBuffer = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${authBuffer}`;
  }

  return axios.create({
    baseURL: connection.baseUrl?.trim().replace(/\/$/, '') || '',
    headers,
    timeout: 15000,
  });
}

async function scanEndpoints(baseUrl, authHeaders = {}) {
  const endpointsToScan = [
    { path: '/products', type: 'Product' },
    { path: '/api/products', type: 'Product' },
    { path: '/customers', type: 'Customer' },
    { path: '/api/customers', type: 'Customer' },
    { path: '/orders', type: 'Order' },
    { path: '/api/orders', type: 'Order' },
    { path: '/categories', type: 'Category' },
    { path: '/api/categories', type: 'Category' },
    { path: '/catalogues', type: 'Catalogue' },
    { path: '/api/catalogues', type: 'Catalogue' },
  ];

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...authHeaders,
  };

  const detected = [];

  for (const item of endpointsToScan) {
    try {
      const url = `${baseUrl.trim().replace(/\/$/, '')}${item.path}`;
      const res = await axios.get(url, { headers, timeout: 5000 });
      
      if (res.status === 200 && res.data) {
        let sample = null;
        if (Array.isArray(res.data)) {
          sample = res.data[0];
        } else if (res.data && typeof res.data === 'object') {
          const keys = Object.keys(res.data);
          for (const k of keys) {
            if (Array.isArray(res.data[k])) {
              sample = res.data[k][0];
              break;
            }
          }
          if (!sample) sample = res.data;
        }

        detected.push({
          path: item.path,
          type: item.type,
          available: true,
          sampleFields: sample ? Object.keys(sample) : [],
        });
      } else {
        detected.push({
          path: item.path,
          type: item.type,
          available: false,
          sampleFields: [],
        });
      }
    } catch (e) {
      detected.push({
        path: item.path,
        type: item.type,
        available: false,
        sampleFields: [],
      });
    }
  }

  return detected;
}

module.exports = {
  createClient,
  scanEndpoints,
};
