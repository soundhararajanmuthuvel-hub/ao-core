const axios = require('axios');
const { decryptCredential } = require('../utils/encryption');

// Lazy load models to avoid circular dependencies during boot
const getModels = () => {
  return {
    IntegrationProduct: require('../models/IntegrationProduct'),
    IntegrationCustomer: require('../models/IntegrationCustomer'),
    IntegrationOrder: require('../models/IntegrationOrder'),
    IntegrationCatalogue: require('../models/IntegrationCatalogue'),
    Product: require('../models/Product'),
    Customer: require('../models/Customer'),
    Order: require('../models/Order'),
    IntegrationLog: require('../models/IntegrationLog'),
    IntegrationSyncJob: require('../models/IntegrationSyncJob')
  };
};

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
    { path: '/invoices', type: 'Invoice' },
    { path: '/api/invoices', type: 'Invoice' },
    { path: '/suppliers', type: 'Supplier' },
    { path: '/api/suppliers', type: 'Supplier' },
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

/**
 * Perform bidirectional sync & conflict resolution on a per-entity basis
 */
async function syncData(connection, entityType, tenantId, client, mappings, job) {
  const models = getModels();
  const { createNotification } = require('../utils/helpers');

  const direction = connection.syncDirection || 'Import';
  const conflictStrategy = connection.conflictStrategy || 'Latest';

  let imported = 0;
  let exported = 0;
  let failed = 0;
  let syncError = null;
  let hasManualConflict = false;

  const typeMappings = mappings.filter(m => m.entityType === entityType);
  const mapFields = (record) => {
    const result = {};
    typeMappings.forEach(m => {
      const val = record[m.externalField];
      if (val !== undefined) {
        result[m.internalField] = val;
      }
    });
    return result;
  };

  try {
    // ==========================================
    // 1. IMPORT SYNC CYCLE (External -> ERP)
    // ==========================================
    if (direction === 'Import' || direction === 'Bidirectional') {
      let path = `/${entityType.toLowerCase()}s`;
      if (connection.platformType === 'WooCommerce') {
        path = `/wp-json/wc/v3/${entityType.toLowerCase()}s`;
      }

      const response = await client.get(path);
      let records = [];

      if (Array.isArray(response.data)) {
        records = response.data;
      } else if (response.data && typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        for (const k of keys) {
          if (Array.isArray(response.data[k])) {
            records = response.data[k];
            break;
          }
        }
      }

      for (const record of records) {
        try {
          const externalId = String(record.id || record.externalId || record.sku || Math.random());
          const mapped = mapFields(record);

          // Get existing import integration cache record
          let existingCache = null;
          let mainModel = null;
          let existingMain = null;

          if (entityType === 'Product') {
            existingCache = await models.IntegrationProduct.findOne({ where: { connectionId: connection.id, externalId, tenantId } });
            mainModel = models.Product;
            existingMain = await mainModel.findOne({ where: { sku: mapped.sku || record.sku || `IMP-PROD-${externalId}` } });
          } else if (entityType === 'Customer') {
            existingCache = await models.IntegrationCustomer.findOne({ where: { connectionId: connection.id, externalId, tenantId } });
            mainModel = models.Customer;
            existingMain = await mainModel.findOne({ where: { phone: mapped.phone || record.phone || '' } });
          } else if (entityType === 'Order') {
            existingCache = await models.IntegrationOrder.findOne({ where: { connectionId: connection.id, externalId, tenantId } });
            mainModel = models.Order;
            existingMain = await mainModel.findOne({ where: { orderNumber: mapped.orderNumber || record.orderNumber || `ORD-${externalId}` } });
          } else if (entityType === 'Catalogue') {
            existingCache = await models.IntegrationCatalogue.findOne({ where: { connectionId: connection.id, externalId, tenantId } });
          }

          // Evaluate Conflict Strategy if record already exists
          let shouldOverwriteLocal = true;

          if (existingCache || existingMain) {
            if (conflictStrategy === 'ERP') {
              // Local wins, skip updating local database
              shouldOverwriteLocal = false;
            } else if (conflictStrategy === 'Manual') {
              // Mark sync job as manual review and trigger notification
              hasManualConflict = true;
              shouldOverwriteLocal = false;
              await createNotification({
                title: `Sync Conflict: ${entityType}`,
                message: `Conflict detected during sync on ${entityType} (ID: ${externalId}). Manual review required.`,
                type: 'warning',
                user: null
              });
            } else if (conflictStrategy === 'Latest') {
              // Compare modification timestamps
              const extUpdate = new Date(record.updatedAt || record.date_modified || record.last_modified || Date.now());
              const localUpdate = new Date(existingCache?.updatedAt || existingMain?.updatedAt || 0);

              if (localUpdate > extUpdate) {
                shouldOverwriteLocal = false;
              }
            }
            // 'External' always overwrites, so shouldOverwriteLocal remains true
          }

          if (shouldOverwriteLocal) {
            // Apply updates
            if (entityType === 'Product') {
              await models.IntegrationProduct.upsert({
                connectionId: connection.id,
                externalId,
                name: mapped.name || record.name || 'Imported Product',
                sku: mapped.sku || record.sku,
                barcode: mapped.barcode || record.barcode,
                category: mapped.category || record.category,
                brand: mapped.brand || record.brand,
                price: Number(mapped.price || record.price || 0),
                mrp: Number(mapped.mrp || record.mrp || 0),
                wholesalePrice: Number(mapped.wholesalePrice || record.wholesalePrice || 0),
                distributorPrice: Number(mapped.distributorPrice || record.distributorPrice || 0),
                stock: Math.round(Number(mapped.stock || record.stock || 0)),
                gst: Number(mapped.gst || record.gst || 0),
                hsn: mapped.hsn || record.hsn,
                weight: Number(mapped.weight || record.weight || 0.0),
                description: mapped.description || record.description,
                benefits: mapped.benefits || record.benefits,
                imageUrl: mapped.imageUrl || record.imageUrl,
                catalogueUrl: mapped.catalogueUrl || record.catalogueUrl,
                status: mapped.status || record.status || 'active',
                tenantId
              });

              await models.Product.upsert({
                name: mapped.name || record.name || 'Imported Product',
                sku: mapped.sku || record.sku || `IMP-PROD-${externalId}`,
                price: Number(mapped.price || record.price || 0),
                stock: Math.round(Number(mapped.stock || record.stock || 0)),
                description: mapped.description || record.description || '',
                benefits: mapped.benefits || record.benefits || '',
                ingredients: mapped.ingredients || record.ingredients || '',
                image: mapped.imageUrl || record.imageUrl || '',
                category: mapped.category || record.category || 'General',
                productType: 'trading',
                unit: 'pcs'
              });
            } else if (entityType === 'Customer') {
              await models.IntegrationCustomer.upsert({
                connectionId: connection.id,
                externalId,
                name: mapped.name || record.name || 'Imported Customer',
                phone: mapped.phone || record.phone,
                email: mapped.email || record.email,
                address: mapped.address || record.address,
                city: mapped.city || record.city,
                state: mapped.state || record.state,
                country: mapped.country || record.country,
                gstNumber: mapped.gstNumber || record.gstNumber,
                customerType: mapped.customerType || record.customerType,
                creditLimit: Number(mapped.creditLimit || record.creditLimit || 0),
                outstanding: Number(mapped.outstanding || record.outstanding || 0),
                tenantId
              });

              await models.Customer.upsert({
                name: mapped.name || record.name || 'Imported Customer',
                phone: mapped.phone || record.phone || '',
                email: mapped.email || record.email || '',
                address: mapped.address || record.address || '',
                gstNumber: mapped.gstNumber || record.gstNumber || '',
                customerType: mapped.customerType || record.customerType || 'Retail Shop'
              });
            } else if (entityType === 'Order') {
              await models.IntegrationOrder.upsert({
                connectionId: connection.id,
                externalId,
                orderNumber: mapped.orderNumber || record.orderNumber || `ORD-${externalId}`,
                customerName: mapped.customerName || record.customerName,
                items: JSON.stringify(mapped.items || record.items || []),
                amount: Number(mapped.amount || record.amount || 0),
                status: mapped.status || record.status || 'Pending',
                paymentStatus: mapped.paymentStatus || record.paymentStatus || 'Unpaid',
                shipmentStatus: mapped.shipmentStatus || record.shipmentStatus || 'Unshipped',
                orderDate: mapped.orderDate || record.orderDate,
                deliveryDate: mapped.deliveryDate || record.deliveryDate,
                tenantId
              });

              await models.Order.upsert({
                orderNumber: mapped.orderNumber || record.orderNumber || `ORD-${externalId}`,
                customerName: mapped.customerName || record.customerName || 'Imported Client',
                phone: mapped.phone || record.phone || '',
                amount: Number(mapped.amount || record.amount || 0),
                items: typeof record.items === 'object' ? JSON.stringify(record.items) : (mapped.items || '[]'),
                status: mapped.status || record.status || 'Pending'
              });
            } else if (entityType === 'Catalogue') {
              await models.IntegrationCatalogue.upsert({
                connectionId: connection.id,
                externalId,
                name: mapped.name || record.name || 'Imported Catalogue',
                pdfUrl: mapped.pdfUrl || record.pdfUrl,
                imageUrl: mapped.imageUrl || record.imageUrl,
                category: mapped.category || record.category,
                productMapping: JSON.stringify(mapped.productMapping || record.productMapping || []),
                version: mapped.version || record.version || '1.0.0',
                tenantId
              });
            }
            imported++;
          }
        } catch (itemErr) {
          failed++;
          console.error(`Item import failed:`, itemErr.message);
        }
      }
    }

    // ==========================================
    // 2. EXPORT SYNC CYCLE (ERP -> External)
    // ==========================================
    if (direction === 'Export' || direction === 'Bidirectional') {
      let localRecords = [];
      if (entityType === 'Product') {
        localRecords = await models.Product.findAll();
      } else if (entityType === 'Customer') {
        localRecords = await models.Customer.findAll();
      } else if (entityType === 'Order') {
        localRecords = await models.Order.findAll();
      }

      for (const localRec of localRecords) {
        try {
          // Identify if record mapping exists in integration cache
          let cacheSearch = null;
          if (entityType === 'Product') {
            cacheSearch = await models.IntegrationProduct.findOne({ where: { connectionId: connection.id, sku: localRec.sku, tenantId } });
          } else if (entityType === 'Customer') {
            cacheSearch = await models.IntegrationCustomer.findOne({ where: { connectionId: connection.id, phone: localRec.phone, tenantId } });
          } else if (entityType === 'Order') {
            cacheSearch = await models.IntegrationOrder.findOne({ where: { connectionId: connection.id, orderNumber: localRec.orderNumber, tenantId } });
          }

          let shouldPushToExternal = true;
          let method = 'POST';
          let endpointPath = `/${entityType.toLowerCase()}s`;

          if (cacheSearch) {
            method = 'PUT';
            endpointPath = `/${entityType.toLowerCase()}s/${cacheSearch.externalId}`;
            
            // Conflict Strategy Checks
            if (conflictStrategy === 'External') {
              shouldPushToExternal = false;
            } else if (conflictStrategy === 'Manual') {
              hasManualConflict = true;
              shouldPushToExternal = false;
            } else if (conflictStrategy === 'Latest') {
              const localUpdate = new Date(localRec.updatedAt);
              const extUpdate = new Date(cacheSearch.updatedAt);
              if (extUpdate > localUpdate) {
                shouldPushToExternal = false;
              }
            }
          }

          if (shouldPushToExternal) {
            // Compile payload
            const payload = {
              name: localRec.name,
              sku: localRec.sku,
              price: localRec.price,
              stock: localRec.stock,
              description: localRec.description,
              phone: localRec.phone,
              email: localRec.email,
              address: localRec.address,
              orderNumber: localRec.orderNumber,
              amount: localRec.amount,
              items: localRec.items
            };

            // Call external API connection
            let extResponse;
            if (method === 'POST') {
              extResponse = await client.post(endpointPath, payload);
            } else {
              extResponse = await client.put(endpointPath, payload);
            }

            // Save or update mapping
            const externalId = String(extResponse?.data?.id || extResponse?.data?.externalId || cacheSearch?.externalId || localRec.id || Math.random());
            
            if (entityType === 'Product') {
              await models.IntegrationProduct.upsert({
                connectionId: connection.id,
                externalId,
                name: localRec.name,
                sku: localRec.sku,
                price: Number(localRec.price || 0),
                stock: Math.round(Number(localRec.stock || 0)),
                description: localRec.description || '',
                tenantId
              });
            } else if (entityType === 'Customer') {
              await models.IntegrationCustomer.upsert({
                connectionId: connection.id,
                externalId,
                name: localRec.name,
                phone: localRec.phone,
                email: localRec.email,
                address: localRec.address,
                tenantId
              });
            } else if (entityType === 'Order') {
              await models.IntegrationOrder.upsert({
                connectionId: connection.id,
                externalId,
                orderNumber: localRec.orderNumber,
                amount: Number(localRec.amount || 0),
                status: localRec.status || 'Pending',
                tenantId
              });
            }
            exported++;
          }
        } catch (exportErr) {
          failed++;
          console.error(`Export item failed:`, exportErr.message);
        }
      }
    }

    if (hasManualConflict) {
      job.status = 'Pending Review';
    } else {
      job.status = 'Completed';
    }
    job.completedAt = new Date();
    await job.save();

  } catch (err) {
    syncError = err.message;
    failed = 1;
    job.status = 'Failed';
    job.errorMessage = err.message;
    job.completedAt = new Date();
    await job.save();
  }

  return {
    success: !syncError,
    imported,
    exported,
    failed,
    errorMessage: syncError,
    status: job.status
  };
}

module.exports = {
  createClient,
  scanEndpoints,
  syncData
};
