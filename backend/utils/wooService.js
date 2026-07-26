const axios = require('axios');
const { Op } = require('sequelize');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Shipment = require('../models/Shipment');
const { getNextInvoiceNumber, getNextShipmentNumber, createNotification, getSettings } = require('./helpers');

/**
 * WooCommerce API Helper Service
 */
class WooCommerceService {
  constructor(settings) {
    this.settings = settings;
    this.url = settings.wooUrl ? settings.wooUrl.replace(/\/$/, '') : '';
    this.consumerKey = settings.wooConsumerKey || '';
    this.consumerSecret = settings.wooConsumerSecret || '';
  }

  getCredentialsParams() {
    return {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
    };
  }

  async writeSyncLog(module, action, successCount, failedCount, duration, errorMsg = null) {
    try {
      const SyncLog = require('../models/SyncLog');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN');
      
      await SyncLog.create({
        date: now.toISOString().split('T')[0],
        time: timeStr,
        module: module,
        action: action,
        success: successCount,
        failed: failedCount,
        duration: duration,
        errorMessage: errorMsg,
      });
    } catch (err) {
      console.error('[SyncLog] Failed to write sync log entry:', err.message);
    }
  }

  async testConnection() {
    if (!this.url || !this.consumerKey || !this.consumerSecret) {
      throw new Error('Website URL, Consumer Key, and Consumer Secret are required');
    }
    const endpoint = `${this.url}/wp-json/wc/v3/products`;
    try {
      const response = await axios.get(endpoint, {
        params: {
          ...this.getCredentialsParams(),
          per_page: 1
        },
        timeout: 10000,
      });
      return response;
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;
        const errorMessage = errorData?.message || errorData?.code || 'WooCommerce API Error';
        throw new Error(errorMessage);
      } else {
        throw err;
      }
    }
  }


  async uploadMedia(filePath, fileName, mimeType) {
    if (!this.url || !this.consumerKey || !this.consumerSecret) {
      throw new Error('WooCommerce store is not connected');
    }
    const fs = require('fs');
    const endpoint = `${this.url}/wp-json/wp/v2/media`;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const response = await axios.post(endpoint, fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
        auth: {
          username: this.consumerKey,
          password: this.consumerSecret,
        },
        timeout: 30000,
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;
        const errorMessage = errorData?.message || errorData?.code || 'WordPress API Error';
        throw new Error(errorMessage);
      } else {
        throw err;
      }
    }
  }

  async deleteProduct(wooProductId) {
    if (!this.url || !this.consumerKey || !this.consumerSecret) {
      throw new Error('WooCommerce store is not connected');
    }
    const endpoint = `${this.url}/wp-json/wc/v3/products/${wooProductId}`;
    try {
      const response = await axios.delete(endpoint, {
        params: {
          ...this.getCredentialsParams(),
          force: true
        },
        timeout: 10000,
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;
        const errorMessage = errorData?.message || errorData?.code || 'WooCommerce API Error';
        throw new Error(errorMessage);
      } else {
        throw err;
      }
    }
  }

  async updateProductStatus(wooProductId, status) {
    if (!this.url || !this.consumerKey || !this.consumerSecret) {
      throw new Error('WooCommerce store is not connected');
    }
    const endpoint = `${this.url}/wp-json/wc/v3/products/${wooProductId}`;
    try {
      const response = await axios.put(endpoint, { status }, {
        params: this.getCredentialsParams(),
        timeout: 10000,
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;
        const errorMessage = errorData?.message || errorData?.code || 'WooCommerce API Error';
        throw new Error(errorMessage);
      } else {
        throw err;
      }
    }
  }

  async runDiagnostics() {
    const diagnostics = {
      websiteReachable: false,
      wpApiReachable: false,
      wooApiReachable: false,
      credentialsValid: false,
      productAccessSuccessful: false,
      connectionStatus: 'Disconnected',
      errorDetails: null,
    };

    if (!this.url) {
      diagnostics.errorDetails = 'Website URL is not configured';
      return diagnostics;
    }

    // 1. Website Reachable
    try {
      await axios.get(this.url, { timeout: 5000 });
      diagnostics.websiteReachable = true;
    } catch (err) {
      if (err.response || err.code === 'ERR_BAD_RESPONSE') {
        diagnostics.websiteReachable = true;
      } else {
        diagnostics.errorDetails = `Website unreachable: ${err.message}`;
        return diagnostics;
      }
    }

    // 2. WordPress API Reachable
    try {
      const wpUrl = `${this.url}/wp-json`;
      const res = await axios.get(wpUrl, { timeout: 5000 });
      if (res.status === 200 || res.response) {
        diagnostics.wpApiReachable = true;
      }
    } catch (err) {
      if (err.response) {
        diagnostics.wpApiReachable = true;
      } else {
        diagnostics.errorDetails = `WordPress API unreachable: ${err.message}`;
        return diagnostics;
      }
    }

    // 3. WooCommerce API Reachable
    try {
      const wooUrl = `${this.url}/wp-json/wc/v3`;
      await axios.get(wooUrl, { timeout: 5000 });
      diagnostics.wooApiReachable = true;
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 200)) {
        diagnostics.wooApiReachable = true;
      } else {
        diagnostics.errorDetails = `WooCommerce API endpoint unreachable: ${err.message}`;
        return diagnostics;
      }
    }

    // 4 & 5. Credentials & Product Access
    const productUrl = `${this.url}/wp-json/wc/v3/products`;
    try {
      const response = await axios.get(productUrl, {
        params: {
          ...this.getCredentialsParams(),
          per_page: 1
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        diagnostics.credentialsValid = true;
        diagnostics.productAccessSuccessful = true;
        diagnostics.connectionStatus = 'Connected';
      }
    } catch (err) {
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          diagnostics.errorDetails = err.response.data?.message || 'Invalid Credentials (401/403)';
        } else {
          diagnostics.errorDetails = err.response.data?.message || `WooCommerce API Error (Status ${err.response.status})`;
        }
      } else {
        diagnostics.errorDetails = err.message;
      }
    }

    return diagnostics;
  }

  async fetchStoreMetadata() {
    const metadata = {
      name: 'Amudhasurabiy Organics',
      url: this.url,
      description: 'Organic Products Store',
      logo: this.url ? `${this.url}/favicon.ico` : '',
      version: '8.0.0',
      wordpressVersion: '6.4',
      currency: 'INR'
    };

    if (!this.url) return metadata;

    try {
      const wpRes = await axios.get(`${this.url}/wp-json`, { timeout: 8000 });
      if (wpRes.data) {
        metadata.name = wpRes.data.name || metadata.name;
        metadata.description = wpRes.data.description || metadata.description;
      }
    } catch (err) {
      console.error('WordPress metadata fetch error:', err.message);
    }

    try {
      const systemRes = await axios.get(`${this.url}/wp-json/wc/v3/system_status`, {
        params: this.getCredentialsParams(),
        timeout: 10000
      });
      if (systemRes.data) {
        metadata.version = systemRes.data.environment?.woocommerce_version || metadata.version;
        metadata.wordpressVersion = systemRes.data.environment?.wp_version || metadata.wordpressVersion;
        metadata.currency = systemRes.data.settings?.currency || metadata.currency;
      }
    } catch (err) {
      console.error('WooCommerce system status fetch error:', err.message);
      try {
        const settingsRes = await axios.get(`${this.url}/wp-json/wc/v3/settings/general`, {
          params: this.getCredentialsParams(),
          timeout: 5000
        });
        if (Array.isArray(settingsRes.data)) {
          const currencySetting = settingsRes.data.find(s => s.id === 'woocommerce_currency');
          if (currencySetting) {
            metadata.currency = currencySetting.value || metadata.currency;
          }
        }
      } catch (innerErr) {
        console.error('WooCommerce settings fallback fetch error:', innerErr.message);
      }
    }

    return metadata;
  }

  async importProducts() {
    const res = await this.importProductsDetailed();
    return res.summary.imported + res.summary.updated;
  }

  async importProductsDetailed() {
    if (!this.url) {
      const err = new Error('WooCommerce API URL not configured. Please check integration settings.');
      err.stage = 'Configuration Check';
      err.fixSuggestion = 'Go to Settings -> Integration and enter your WooCommerce Store URL.';
      throw err;
    }

    const startTime = Date.now();
    let receivedCount = 0;
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let imagesImportedCount = 0;
    let categoriesImportedCount = 0;
    const errorsList = [];
    const warningsList = [];
    const categorySet = new Set();
    let page = 1;
    let keepFetching = true;

    try {
      while (keepFetching) {
        let response;
        try {
          response = await axios.get(`${this.url}/wp-json/wc/v3/products`, {
            params: {
              ...this.getCredentialsParams(),
              per_page: 100,
              page: page,
            },
            timeout: 25000,
          });
        } catch (apiErr) {
          const status = apiErr.response ? apiErr.response.status : 'Network / Timeout';
          const msg = apiErr.response?.data?.message || apiErr.message;
          const err = new Error(`[Fetch WooCommerce API (Status ${status})] ${msg}`);
          err.stage = 'Fetch WooCommerce API';
          err.details = `HTTP Status: ${status}. URL: ${this.url}/wp-json/wc/v3/products. Stack: ${apiErr.stack}`;
          err.fixSuggestion = 'Verify WooCommerce Store URL, Consumer Key, and Consumer Secret in Settings -> Integration.';
          throw err;
        }

        const products = response.data;
        if (!products || products.length === 0) {
          keepFetching = false;
          break;
        }

        receivedCount += products.length;

        for (const wpProd of products) {
          const sku = wpProd.sku || `WOO-PROD-${wpProd.id}`;
          const prodName = wpProd.name || 'WooCommerce Product';

          // Transaction boundary per product
          const t = await sequelize.transaction();

          try {
            let categoryName = 'General';
            if (wpProd.categories && wpProd.categories.length > 0) {
              categoryName = wpProd.categories[0].name;
              if (!categorySet.has(categoryName)) {
                categorySet.add(categoryName);
                categoriesImportedCount++;
              }
            }

            let imageUrl = '';
            if (wpProd.images && wpProd.images.length > 0) {
              imageUrl = wpProd.images[0].src;
              imagesImportedCount++;
            }

            let galleryImagesList = [];
            if (wpProd.images && wpProd.images.length > 1) {
              galleryImagesList = wpProd.images.slice(1).map(img => img.src);
              imagesImportedCount += galleryImagesList.length;
            }

            let dimensionsText = '';
            if (wpProd.dimensions) {
              const { length, width, height } = wpProd.dimensions;
              if (length || width || height) {
                dimensionsText = `${length || 0} x ${width || 0} x ${height || 0}`;
              }
            }

            let brandName = '';
            if (wpProd.attributes && wpProd.attributes.length > 0) {
              const brandAttr = wpProd.attributes.find(a => a.name.toLowerCase() === 'brand');
              if (brandAttr && brandAttr.options && brandAttr.options.length > 0) {
                brandName = brandAttr.options[0];
              }
            }

            const descriptionText = wpProd.description || '';
            const shortDescText = wpProd.short_description || '';
            
            let attributesText = '';
            if (wpProd.attributes && wpProd.attributes.length > 0) {
              attributesText = '\n\nAttributes:\n' + wpProd.attributes.map(attr => {
                const options = attr.options ? attr.options.join(', ') : '';
                return `${attr.name}: ${options}`;
              }).join('\n');
            }

            let tagsText = '';
            if (wpProd.tags && wpProd.tags.length > 0) {
              tagsText = '\n\nTags: ' + wpProd.tags.map(t => t.name).join(', ');
            }

            const fullDescription = `${shortDescText}\n\n${descriptionText}${attributesText}${tagsText}`.trim();
            const wpModified = wpProd.date_modified ? new Date(wpProd.date_modified) : null;

            const productData = {
              name: prodName,
              sku: sku,
              description: fullDescription,
              shortDescription: shortDescText,
              category: categoryName,
              image: imageUrl,
              price: Number(wpProd.regular_price || wpProd.price || 0),
              salePrice: Number(wpProd.sale_price || 0),
              sellingPrice: Number(wpProd.price || wpProd.regular_price || 0),
              stock: Math.max(0, Math.round(Number(wpProd.stock_quantity || 0))),
              status: wpProd.status || 'publish',
              weight: Number(wpProd.weight || 0.200),
              attributes: JSON.stringify(wpProd.attributes || []),
              tags: JSON.stringify(wpProd.tags || []),
              gstClass: wpProd.tax_class || '',
              lastModifiedDate: wpModified,
              lastSyncTimestamp: new Date(),
              lastWooUpdateTimestamp: wpModified,
              woocommerce_product_id: String(wpProd.id),
              wooProductId: String(wpProd.id),
              brand: brandName,
              galleryImages: JSON.stringify(galleryImagesList),
              dimensions: dimensionsText,
              stockStatus: wpProd.stock_status || 'instock',
              woocommerce_last_modified: wpModified,
              woocommerce_sync_status: 'synced',
              woocommerce_permalink: wpProd.permalink || '',
            };

            // Enterprise Schema Compatibility Layer
            const sanitizeForModel = (model, data) => {
              const allowedKeys = Object.keys(model.rawAttributes || {});
              const sanitized = {};
              for (const key of allowedKeys) {
                if (data[key] !== undefined) {
                  sanitized[key] = data[key];
                }
              }
              return sanitized;
            };

            const safeProductData = sanitizeForModel(Product, productData);

            let existingProduct = await Product.findOne({
              where: {
                [Op.or]: [
                  { woocommerce_product_id: String(wpProd.id) },
                  { wooProductId: String(wpProd.id) }
                ]
              },
              transaction: t
            });

            if (!existingProduct && wpProd.sku) {
              existingProduct = await Product.findOne({ where: { sku: wpProd.sku }, transaction: t });
            }

            if (existingProduct) {
              await existingProduct.update(safeProductData, { transaction: t });
              updatedCount++;
            } else {
              await Product.create({
                ...safeProductData,
                productType: 'trading',
                unit: 'pcs',
              }, { transaction: t });
              importedCount++;
            }

            await t.commit();
          } catch (itemErr) {
            await t.rollback();
            console.error(`[Woo Sync Failure] Item ${wpProd.id} (${prodName} / ${sku}):`, itemErr.message);
            failedCount++;
            errorsList.push({
              productId: wpProd.id,
              sku: sku,
              productName: prodName,
              stage: 'Save Product',
              reason: itemErr.message,
              sqlError: itemErr.code || null
            });
          }
        }

        if (products.length < 100) {
          keepFetching = false;
        } else {
          page++;
        }
      }

      await this.writeSyncLog('Products', 'Import', importedCount + updatedCount, failedCount, Date.now() - startTime);

      return {
        success: true,
        summary: {
          received: receivedCount,
          imported: importedCount,
          updated: updatedCount,
          skipped: skippedCount,
          failed: failedCount,
          imagesImported: imagesImportedCount,
          categoriesImported: categoriesImportedCount,
          errors: errorsList,
          warnings: warningsList,
          durationMs: Date.now() - startTime
        }
      };
    } catch (err) {
      await this.writeSyncLog('Products', 'Import', importedCount + updatedCount, failedCount || 1, Date.now() - startTime, err.message);
      console.error(`[WooCommerce Import Fatal Error]:`, err.message);
      throw err;
    }
  }

  async fetchSingleProduct(wooId) {
    if (!this.url) throw new Error('WooCommerce API not configured');
    const endpoint = `${this.url}/wp-json/wc/v3/products/${wooId}`;
    try {
      const response = await axios.get(endpoint, {
        params: this.getCredentialsParams(),
        timeout: 15000,
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        const errorData = err.response.data;
        throw new Error(errorData?.message || `WooCommerce API Error (Status ${err.response.status})`);
      }
      throw err;
    }
  }

  async syncProducts() {
    if (!this.url) throw new Error('WooCommerce API not configured');

    if (this.settings.wooProductSyncMode === 'Website Master') {
      console.log('[Product Sync] Skipped pushing products because sync mode is set to Website Master.');
      return { successCount: 0, failedCount: 0, failures: [] };
    }

    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const failures = [];

    try {
      const localProducts = await Product.findAll({
        where: {
          productType: { [Op.in]: ['manufactured', 'repacking', 'trading'] },
          isArchived: { [Op.ne]: true }
        }
      });

      for (const prod of localProducts) {
        if (!prod.sku) {
          failures.push({
            stage: 'Validation',
            product: prod.name,
            sku: 'N/A',
            error: 'Missing SKU'
          });
          failedCount++;
          continue;
        }

        let galleryList = [];
        try {
          if (prod.galleryImages) {
            galleryList = JSON.parse(prod.galleryImages).map(url => ({ src: url }));
          }
        } catch {}

        const imagesPayload = [];
        if (prod.image) {
          imagesPayload.push({ src: prod.image });
        }
        galleryList.forEach(img => imagesPayload.push(img));

        const payload = {
          name: prod.name,
          sku: prod.sku,
          regular_price: String(prod.price || prod.sellingPrice || 0),
          sale_price: String(prod.salePrice || 0),
          manage_stock: true,
          stock_quantity: Math.max(0, Math.round(Number(prod.stock || 0))),
          description: prod.description || `${prod.name} - synced from AO Core ERP.`,
          short_description: prod.shortDescription || '',
          weight: String(prod.weight || 0.200),
          status: prod.status || 'publish',
          tax_class: prod.gstClass || '',
          images: imagesPayload
        };

        try {
          const searchRes = await axios.get(`${this.url}/wp-json/wc/v3/products`, {
            params: { ...this.getCredentialsParams(), sku: prod.sku },
          });

          if (searchRes.data && searchRes.data.length > 0) {
            const wooId = searchRes.data[0].id;
            await axios.put(`${this.url}/wp-json/wc/v3/products/${wooId}`, payload, {
              params: this.getCredentialsParams(),
            });
            prod.wooProductId = String(wooId);
            prod.woocommerce_product_id = String(wooId);
            await prod.save();
          } else {
            const createRes = await axios.post(`${this.url}/wp-json/wc/v3/products`, payload, {
              params: this.getCredentialsParams(),
            });
            prod.wooProductId = String(createRes.data.id);
            prod.woocommerce_product_id = String(createRes.data.id);
            await prod.save();
          }
          successCount++;
        } catch (err) {
          console.error(`Error syncing product ${prod.sku}:`, err.message);
          let apiError = err.message;
          if (err.response && err.response.data && err.response.data.message) {
            apiError = err.response.data.message;
          }
          failures.push({
            stage: 'API Request',
            product: prod.name,
            sku: prod.sku,
            error: apiError,
            details: err.response?.data?.code || 'WC_ERROR'
          });
          failedCount++;
        }
      }

      await this.writeSyncLog('Products', 'Export', successCount, failedCount, Date.now() - startTime);
      return { successCount, failedCount, failures };
    } catch (err) {
      await this.writeSyncLog('Products', 'Export', successCount, failedCount || 1, Date.now() - startTime, err.message);
      return { successCount, failedCount, failures: [{ stage: 'Database Query', error: err.message }] };
    }
  }

  async syncCustomers() {
    if (!this.url) throw new Error('WooCommerce API not configured');

    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    try {
      const res = await axios.get(`${this.url}/wp-json/wc/v3/customers`, {
        params: { ...this.getCredentialsParams(), per_page: 100 },
      });

      for (const wooCust of res.data) {
        try {
          const email = wooCust.email;
          const phone = wooCust.billing?.phone || wooCust.shipping?.phone || '';
          const name = `${wooCust.first_name || ''} ${wooCust.last_name || ''}`.trim() || wooCust.username;

          let customer = await Customer.findOne({
            where: {
              [Op.or]: [
                email ? { email } : null,
                phone ? { phone } : null,
              ].filter(Boolean)
            }
          });

          const address = `${wooCust.billing?.address_1 || ''} ${wooCust.billing?.address_2 || ''} ${wooCust.billing?.city || ''} ${wooCust.billing?.state || ''} ${wooCust.billing?.postcode || ''}`.trim();
          let gstNumber = '';
          if (wooCust.meta_data && Array.isArray(wooCust.meta_data)) {
            const gstMeta = wooCust.meta_data.find(m => m.key === 'billing_gst' || m.key === 'gst' || m.key === 'gst_number');
            if (gstMeta) {
              gstNumber = gstMeta.value;
            }
          }

          const customerData = {
            name,
            email,
            phone,
            address,
            gstNumber,
            state: wooCust.billing?.state || '',
            pincode: wooCust.billing?.postcode || '',
            wooCustomerId: String(wooCust.id),
          };

          if (customer) {
            customer.wooCustomerId = String(wooCust.id);
            if (address && !customer.address) customer.address = address;
            if (gstNumber) customer.gstNumber = gstNumber;
            customer.state = wooCust.billing?.state || customer.state;
            customer.pincode = wooCust.billing?.postcode || customer.pincode;
            await customer.save();
          } else {
            await Customer.create({
              ...customerData,
              customerType: 'D2C Customer',
              gstBillingMode: 'inclusive',
            });
          }
          successCount++;
        } catch (err) {
          console.error(`Failed to sync customer ${wooCust.id}:`, err.message);
          failedCount++;
        }
      }

      await this.writeSyncLog('Customers', 'Import', successCount, failedCount, Date.now() - startTime);
      return successCount;
    } catch (err) {
      await this.writeSyncLog('Customers', 'Import', successCount, failedCount || 1, Date.now() - startTime, err.message);
      throw err;
    }
  }

  async syncOrders(userId = 1) {
    if (!this.url) throw new Error('WooCommerce API not configured');

    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    try {
      const res = await axios.get(`${this.url}/wp-json/wc/v3/orders`, {
        params: { ...this.getCredentialsParams(), per_page: 50, status: 'any' },
      });

      for (const order of res.data) {
        try {
          const imported = await this.importOrder(order, userId);
          if (imported) successCount++;
        } catch (err) {
          console.error(`Failed to import order ${order.id}:`, err.message);
          failedCount++;
        }
      }

      await this.writeSyncLog('Orders', 'Import', successCount, failedCount, Date.now() - startTime);
      return successCount;
    } catch (err) {
      await this.writeSyncLog('Orders', 'Import', successCount, failedCount || 1, Date.now() - startTime, err.message);
      throw err;
    }
  }

  async importOrder(order, userId = 1) {
    const mapWooStatusToErp = (wooStatus) => {
      switch (String(wooStatus).toLowerCase()) {
        case 'pending':
          return 'Pending';
        case 'processing':
          return 'Packed';
        case 'completed':
          return 'Delivered';
        case 'cancelled':
          return 'Cancelled';
        case 'refunded':
          return 'Returned';
        default:
          return 'Pending';
      }
    };

    // Check if invoice already exists
    const exists = await Invoice.findOne({
      where: { wooOrderId: String(order.id) }
    });

    if (exists) {
      const newStatus = mapWooStatusToErp(order.status);
      const newPaymentStatus = ['completed', 'processing'].includes(order.status) ? 'paid' : 'pending';
      const newAmountPaid = ['completed', 'processing'].includes(order.status) ? exists.grandTotal : 0;
      
      if (exists.status !== newStatus || exists.paymentStatus !== newPaymentStatus) {
        exists.status = newStatus;
        exists.paymentStatus = newPaymentStatus;
        exists.amountPaid = newAmountPaid;
        await exists.save();
        return true;
      }
      return false;
    }

    // 1. Find or create Customer
    const email = order.billing?.email || '';
    const phone = order.billing?.phone || '';
    const name = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'WooCommerce Customer';
    const address = `${order.billing?.address_1 || ''} ${order.billing?.address_2 || ''} ${order.billing?.city || ''} ${order.billing?.state || ''} ${order.billing?.postcode || ''}`.trim();
    let gstNumber = '';
    if (order.meta_data && Array.isArray(order.meta_data)) {
      const gstMeta = order.meta_data.find(m => m.key === 'billing_gst' || m.key === 'gst' || m.key === 'gst_number');
      if (gstMeta) {
        gstNumber = gstMeta.value;
      }
    }

    let customer = await Customer.findOne({
      where: {
        [Op.or]: [
          email ? { email } : null,
          phone ? { phone } : null,
        ].filter(Boolean)
      }
    });

    if (!customer) {
      customer = await Customer.create({
        name,
        email,
        phone,
        address,
        state: order.billing?.state || '',
        pincode: order.billing?.postcode || '',
        gstNumber,
        customerType: 'D2C Customer',
        gstBillingMode: 'inclusive',
        wooCustomerId: order.customer_id ? String(order.customer_id) : null,
      });
    } else {
      let isCustChanged = false;
      if (order.customer_id && !customer.wooCustomerId) {
        customer.wooCustomerId = String(order.customer_id);
        isCustChanged = true;
      }
      if (gstNumber && !customer.gstNumber) {
        customer.gstNumber = gstNumber;
        isCustChanged = true;
      }
      if (isCustChanged) {
        await customer.save();
      }
    }

    // 2. Prepare Cart items by matching SKUs
    const invoiceItems = [];
    let totalWeight = 0;

    for (const item of order.line_items) {
      const product = await Product.findOne({
        where: {
          [Op.or]: [
            item.sku ? { sku: item.sku } : null,
            { wooProductId: String(item.product_id) }
          ].filter(Boolean)
        }
      });

      if (!product) continue;

      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.price || 0);
      const gstPercent = Number(product.gstPercent || 0);
      const weight = Number(product.weight || 0.200);

      totalWeight += qty * weight;

      // Under Inclusive Mode, the line total matches total base paid
      const lineTotal = qty * unitPrice;

      invoiceItems.push({
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        gstPercent,
        lineTotal,
        purchasePrice: Number(product.purchasePrice || 0),
        dispatchedQty: 0,
        pendingQty: qty,
      });
    }

    if (invoiceItems.length === 0) return false;

    // 3. Calculate invoice totals (assume inclusive billing for D2C e-commerce)
    const discount = Number(order.discount_total || 0);
    const shippingCharge = Number(order.shipping_total || 0);

    // Inclusive billing math
    let subtotal = 0;
    let gstTotal = 0;
    invoiceItems.forEach(item => {
      const totalBase = item.lineTotal;
      const taxable = totalBase / (1 + item.gstPercent / 100);
      const gst = totalBase - taxable;
      subtotal += taxable;
      gstTotal += gst;
    });

    const grandTotal = subtotal + gstTotal + shippingCharge - discount;
    const roundedTotal = Math.round(grandTotal);
    const roundOff = roundedTotal - grandTotal;

    const invoiceNumber = await getNextInvoiceNumber();
    const erpStatus = mapWooStatusToErp(order.status);

    // Calculate internal logistics costs for reporting
    const settings = await getSettings();
    const packingCost = Number(settings.packingCost || 0);
    const handlingCost = Number(settings.handlingCost || 0);
    const loadingCost = Number(settings.loadingCost || 0);
    
    let courierCost = Number(settings.courierCost || 0);
    if (settings.shippingMode === 'fixed') {
      courierCost = Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'weight') {
      let weightRules = [];
      try {
        weightRules = JSON.parse(settings.shippingWeightRules || '[]');
      } catch (e) {}
      const weightGrams = totalWeight * 1000;
      const rule = weightRules.find(r => weightGrams >= r.min && weightGrams <= r.max);
      courierCost = rule ? Number(rule.charge) : Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'zone') {
      const stateStr = (order.billing?.state || '').toLowerCase().trim();
      let zone = 'rest_of_india';
      if (['tamil nadu', 'tamilnadu', 'tn'].includes(stateStr)) {
        zone = 'tamil_nadu';
      } else if (['kerala', 'karnataka', 'andhra pradesh', 'andhrapradesh', 'ap', 'telangana', 'puducherry', 'pondicherry', 'lakshadweep'].includes(stateStr)) {
        zone = 'south_india';
      }
      const zoneRates = JSON.parse(settings.shippingZoneRates || '{"tamil_nadu":50,"south_india":80,"rest_of_india":120}');
      const ratePerKg = Number(zoneRates[zone] || 120);
      const courierWeight = totalWeight <= 1.0 ? 1.5 : totalWeight;
      courierCost = courierWeight * ratePerKg;
    } else if (settings.shippingMode === 'value') {
      if (subtotal >= Number(settings.shippingValueThreshold || 999)) {
        courierCost = Number(settings.shippingValueAboveCharge || 0);
      } else {
        courierCost = Number(settings.shippingValueBelowCharge || 80);
      }
    }

    // 4. Create Invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      customerId: customer.id,
      date: new Date(order.date_created || new Date()),
      status: erpStatus,
      subtotal,
      discount,
      gstTotal,
      grandTotal: roundedTotal,
      paymentMethod: ['cod', 'cash'].includes(order.payment_method) ? 'cash' : (order.payment_method === 'upi' ? 'upi' : 'card'),
      paymentStatus: ['completed', 'processing'].includes(order.status) ? 'paid' : 'pending',
      amountPaid: ['completed', 'processing'].includes(order.status) ? roundedTotal : 0,
      customerType: 'D2C Customer',
      salesChannel: 'D2C',
      createdById: userId,
      gstBillingMode: 'inclusive',
      shippingCharge,
      packingCost,
      handlingCost,
      courierCost,
      loadingCost,
      roundOff,
      taxableValue: subtotal,
      wooOrderId: String(order.id),
    });

    // 5. Create Invoice Items
    for (const item of invoiceItems) {
      await InvoiceItem.create({
        invoiceId: invoice.id,
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent,
        lineTotal: item.lineTotal,
        purchasePrice: item.purchasePrice,
        dispatchedQty: item.dispatchedQty,
        pendingQty: item.pendingQty,
      });
    }

    // 6. Create Shipment Draft
    const shipmentNumber = await getNextShipmentNumber();
    await Shipment.create({
      invoiceId: invoice.id,
      shipmentNumber,
      courierStatus: 'Pending',
      packageWeight: totalWeight,
      packageCount: 1,
      courier: 'Self Shipment / Website Logistics',
      trackingNumber: `WOO-${order.id}`,
    });

    return true;
  }

  async updateStockOnWoo(sku, stock) {
    if (!this.url || !sku) return;
    try {
      if (this.settings.wooInventorySyncMode === 'Website Master') {
        return;
      }
      // Find product on Woo by SKU
      const searchRes = await axios.get(`${this.url}/wp-json/wc/v3/products`, {
        params: { ...this.getCredentialsParams(), sku },
      });

      if (searchRes.data && searchRes.data.length > 0) {
        const wooId = searchRes.data[0].id;
        await axios.put(`${this.url}/wp-json/wc/v3/products/${wooId}`, {
          manage_stock: true,
          stock_quantity: Math.max(0, Math.round(Number(stock))),
        }, {
          params: this.getCredentialsParams(),
        });
      }
    } catch (err) {
      console.error(`WooCommerce updateStockOnWoo error for SKU ${sku}:`, err.message);
    }
  }

  async pushShipmentDetails(wooOrderId, trackingNumber, courierName, trackingUrl, status) {
    if (!this.url || !wooOrderId) return;
    try {
      console.log(`[WooCommerce Shipping Push] Pushing tracking details to WooCommerce for Order ${wooOrderId}...`);
      
      const payload = {
        meta_data: [
          { key: '_tracking_number', value: trackingNumber },
          { key: '_tracking_provider', value: courierName },
          { key: '_tracking_url', value: trackingUrl },
          { key: '_shipment_status', value: status },
        ]
      };

      await axios.put(`${this.url}/wp-json/wc/v3/orders/${wooOrderId}`, {
        meta_data: payload.meta_data,
        status: status === 'Delivered' ? 'completed' : 'processing'
      }, {
        params: this.getCredentialsParams(),
      });

      await axios.post(`${this.url}/wp-json/wc/v3/orders/${wooOrderId}/notes`, {
        note: `Shipment registered. Courier: ${courierName}, Tracking #: ${trackingNumber}, URL: ${trackingUrl}. Status: ${status}`,
        customer_note: true
      }, {
        params: this.getCredentialsParams(),
      });

      console.log(`[WooCommerce Shipping Push] Successfully updated WooCommerce Order ${wooOrderId}.`);
      
      // Simulate Email and WhatsApp notifications
      console.log(`\n=== CUSTOMER NOTIFICATIONS ===`);
      console.log(`[Email] Dispatch notification sent to WooCommerce customer for Order ${wooOrderId}. Link: ${trackingUrl}`);
      console.log(`[WhatsApp] Dispatch notification sent to customer for Order ${wooOrderId}. Link: ${trackingUrl}`);
      console.log(`==============================\n`);

    } catch (err) {
      console.error(`[WooCommerce Shipping Push] Error updating Order ${wooOrderId}:`, err.message);
    }
  }

  async syncInventory() {
    if (!this.url) throw new Error('WooCommerce API not configured');

    if (this.settings.wooInventorySyncMode === 'Website Master') {
      console.log('[Inventory Sync] Skipped pushing inventory because sync mode is set to Website Master.');
      return 0;
    }

    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    try {
      const localProducts = await Product.findAll({
        where: {
          productType: { [Op.in]: ['manufactured', 'repacking', 'trading'] }
        }
      });

      for (const prod of localProducts) {
        if (!prod.sku) continue;
        try {
          await this.updateStockOnWoo(prod.sku, prod.stock || 0);
          successCount++;
        } catch (err) {
          console.error(`Error syncing inventory for SKU ${prod.sku}:`, err.message);
          failedCount++;
        }
      }

      await this.writeSyncLog('Inventory', 'Export', successCount, failedCount, Date.now() - startTime);
      return successCount;
    } catch (err) {
      await this.writeSyncLog('Inventory', 'Export', successCount, failedCount || 1, Date.now() - startTime, err.message);
      throw err;
    }
  }
}

module.exports = WooCommerceService;
