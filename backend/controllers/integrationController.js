const WooCommerceService = require('../utils/wooService');
const { getSettings, logActivity, createNotification } = require('../utils/helpers');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const ActivityLog = require('../models/ActivityLog');
const { Op } = require('sequelize');

exports.testWooConnection = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);

    let connected = false;
    let wooError = null;

    try {
      const response = await woo.testConnection();
      if (response && response.status === 200) {
        connected = true;
      }
    } catch (err) {
      wooError = err.message || 'WooCommerce API connection failed';
    }

    const diagnostics = await woo.runDiagnostics();

    res.json({
      success: connected,
      connected,
      message: connected ? '✓ Connected Successfully' : (wooError || 'Failed to connect to WooCommerce'),
      diagnostics,
    });
  } catch (err) {
    next(err);
  }
};

exports.connectWooWebsite = async (req, res, next) => {
  try {
    const settings = await getSettings();
    
    // Save credentials first
    Object.assign(settings, req.body);
    await settings.save();

    const woo = new WooCommerceService(settings);
    
    // Test Connection first
    let connected = false;
    try {
      const testRes = await woo.testConnection();
      if (testRes && testRes.status === 200) {
        connected = true;
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Connection failed: ' + err.message
      });
    }

    if (!connected) {
      return res.status(400).json({
        success: false,
        message: 'Could not connect to WooCommerce. Please verify URL and credentials.'
      });
    }

    // Connection succeeded! Automatically fetch metadata
    console.log('WooCommerce connected successfully. Fetching store metadata...');
    const metadata = await woo.fetchStoreMetadata();

    // Auto-update Company Profile
    settings.wooConnected = true;
    settings.companyName = metadata.name || settings.companyName;
    settings.logo = metadata.logo || settings.logo;
    settings.wooStoreDescription = metadata.description || settings.wooStoreDescription;
    settings.wooVersion = metadata.version || settings.wooVersion;
    settings.wooWordpressVersion = metadata.wordpressVersion || settings.wooWordpressVersion;
    settings.wooApiStatus = 'Connected';
    settings.wooCurrency = metadata.currency || settings.wooCurrency;
    
    await settings.save();
    await logActivity(req.user.id, 'connect', 'settings', `Connected WooCommerce site: ${settings.companyName}`);

    res.json({
      success: true,
      message: '✓ Connected Successfully & Profile Synced',
      settings,
      metadata
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerProductSync = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const count = await woo.syncProducts();

    await logActivity(req.user.id, 'sync', 'products', `Synced ${count} products to WooCommerce`);

    res.json({
      success: true,
      count,
      message: `Successfully synced ${count} products to WooCommerce`,
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerProductImport = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const count = await woo.importProducts();

    await logActivity(req.user.id, 'sync', 'products', `Imported ${count} products from WooCommerce`);

    // Update last sync time
    settings.wooLastSyncTime = new Date();
    await settings.save();

    res.json({
      success: true,
      count,
      message: `Successfully imported/updated ${count} products from WooCommerce`,
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerCustomerSync = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const count = await woo.syncCustomers();

    await logActivity(req.user.id, 'sync', 'customers', `Synced ${count} customers from WooCommerce`);

    // Update last sync time
    settings.wooLastSyncTime = new Date();
    await settings.save();

    res.json({
      success: true,
      count,
      message: `Successfully synced ${count} customers from WooCommerce`,
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerOrderSync = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const count = await woo.syncOrders(req.user?.id || 1);

    await logActivity(req.user.id, 'sync', 'sales', `Synced ${count} orders from WooCommerce`);

    // Update last sync time
    settings.wooLastSyncTime = new Date();
    await settings.save();

    res.json({
      success: true,
      count,
      message: `Successfully synced ${count} orders from WooCommerce`,
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerInventorySync = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const count = await woo.syncInventory();

    await logActivity(req.user.id, 'sync', 'inventory', `Synced inventory for ${count} products to WooCommerce`);

    // Update last sync time
    settings.wooLastSyncTime = new Date();
    await settings.save();

    res.json({
      success: true,
      count,
      message: `Successfully synced inventory for ${count} products to WooCommerce`,
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerSyncAll = async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (!settings.wooConnected) {
      return res.status(400).json({ success: false, message: 'WooCommerce integration is not connected.' });
    }

    const woo = new WooCommerceService(settings);

    // Run sync tasks sequentially
    let customersCount = 0;
    let productsCount = 0;
    let ordersCount = 0;
    let inventoryCount = 0;

    try {
      customersCount = await woo.syncCustomers();
    } catch (e) {
      console.error('SyncAll - Customer sync error:', e.message);
    }

    try {
      productsCount = await woo.importProducts();
    } catch (e) {
      console.error('SyncAll - Product import error:', e.message);
    }

    try {
      ordersCount = await woo.syncOrders(req.user?.id || 1);
    } catch (e) {
      console.error('SyncAll - Order sync error:', e.message);
    }

    try {
      inventoryCount = await woo.syncInventory();
    } catch (e) {
      console.error('SyncAll - Inventory sync error:', e.message);
    }

    // Update last sync time
    settings.wooLastSyncTime = new Date();
    await settings.save();

    await logActivity(req.user.id, 'sync', 'all', `Completed full manual WooCommerce sync`);

    res.json({
      success: true,
      message: 'Full WooCommerce synchronization completed successfully',
      details: {
        customersSynced: customersCount,
        productsImported: productsCount,
        ordersSynced: ordersCount,
        inventorySynced: inventoryCount
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getWooIntegrationStats = async (req, res, next) => {
  try {
    const settings = await getSettings();

    const productsCount = await Product.count({
      where: {
        wooProductId: { [Op.ne]: null }
      }
    });

    const customersCount = await Customer.count({
      where: {
        wooCustomerId: { [Op.ne]: null }
      }
    });

    const ordersCount = await Invoice.count({
      where: {
        wooOrderId: { [Op.ne]: null }
      }
    });

    res.json({
      success: true,
      productsFound: productsCount,
      customersFound: customersCount,
      ordersFound: ordersCount,
      lastSyncTime: settings.wooLastSyncTime || null,
      lastProductSyncTime: settings.wooLastProductSyncTime || null,
      lastOrderSyncTime: settings.wooLastOrderSyncTime || null,
      lastCustomerSyncTime: settings.wooLastCustomerSyncTime || null,
      lastInventorySyncTime: settings.wooLastInventorySyncTime || null,
      wooConnected: settings.wooConnected,
      wooUrl: settings.wooUrl,
      wooVersion: settings.wooVersion || 'N/A',
      wooWordpressVersion: settings.wooWordpressVersion || 'N/A',
      wooApiStatus: settings.wooApiStatus || 'Disconnected',
      wooProductSyncMode: settings.wooProductSyncMode || 'Two-Way Sync',
      wooOrderSyncMode: settings.wooOrderSyncMode || 'Real-Time',
      wooInventorySyncMode: settings.wooInventorySyncMode || 'Two-Way Sync',
      wooCurrency: settings.wooCurrency || 'INR',
      wooStoreDescription: settings.wooStoreDescription || '',
      companyName: settings.companyName,
      logo: settings.logo
    });
  } catch (err) {
    next(err);
  }
};

exports.handleWooWebhook = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const order = req.body;

    if (!order || !order.id) {
      return res.status(400).json({ success: false, message: 'Invalid order payload' });
    }

    const woo = new WooCommerceService(settings);
    const imported = await woo.importOrder(order, 1);

    res.json({
      success: true,
      imported,
      message: imported ? `Order ${order.id} imported successfully via Webhook` : `Order ${order.id} was skipped (already exists or no matching products)`,
    });
  } catch (err) {
    console.error('Webhook order import error:', err.message);
    // Return 200 to acknowledge webhook receipt even if error, to prevent WooCommerce from disabling webhook
    res.status(200).json({
      success: false,
      message: 'Failed to process WooCommerce order webhook: ' + err.message,
    });
  }
};

exports.forceRefreshProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const wooId = product.woocommerce_product_id || product.wooProductId;
    if (!wooId) {
      return res.status(400).json({ success: false, message: 'This product is not linked to WooCommerce' });
    }

    const settings = await getSettings();
    const woo = new WooCommerceService(settings);
    const wpProd = await woo.fetchSingleProduct(wooId);

    const sku = wpProd.sku || product.sku || `WOO-PROD-${wpProd.id}`;

    let categoryName = 'General';
    if (wpProd.categories && wpProd.categories.length > 0) {
      categoryName = wpProd.categories[0].name;
    }

    let imageUrl = '';
    if (wpProd.images && wpProd.images.length > 0) {
      imageUrl = wpProd.images[0].src;
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
    const lastWooUpdate = product.lastWooUpdateTimestamp ? new Date(product.lastWooUpdateTimestamp) : null;
    let isChanged = false;

    if (!lastWooUpdate || (wpModified && wpModified.getTime() !== lastWooUpdate.getTime())) {
      isChanged = true;
    }

    const productData = {
      name: wpProd.name || product.name,
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
    };

    await product.update(productData);

    if (isChanged) {
      await createNotification({
        title: 'Product updated from WooCommerce',
        message: `Product "${productData.name}" (SKU: ${productData.sku}) was manually refreshed with updates from WooCommerce.`,
        type: 'info',
        user: null
      });
    }

    await logActivity(req.user.id, 'sync', 'products', `Refreshed WooCommerce product: ${product.name}`);

    res.json({
      success: true,
      message: '✓ Product updated successfully from WooCommerce',
      product
    });
  } catch (err) {
    next(err);
  }
};

exports.disconnectWooWebsite = async (req, res, next) => {
  try {
    const settings = await getSettings();
    settings.wooConnected = false;
    settings.wooUrl = '';
    settings.wooConsumerKey = '';
    settings.wooConsumerSecret = '';
    settings.wooApiKey = '';
    settings.wooWebhookSecret = '';
    settings.wooVersion = '';
    settings.wooWordpressVersion = '';
    settings.wooApiStatus = 'Disconnected';
    await settings.save();

    await logActivity(req.user.id, 'disconnect', 'settings', 'Disconnected WooCommerce website');
    res.json({ success: true, message: '✓ Website Disconnected successfully', settings });
  } catch (err) {
    next(err);
  }
};

exports.handleProductWebhook = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const settings = await getSettings();
    const wpProd = req.body;
    
    if (!wpProd || !wpProd.id) {
      return res.status(400).json({ success: false, message: 'Invalid product payload' });
    }

    const woo = new WooCommerceService(settings);
    const wooId = String(wpProd.id);
    const topic = req.headers['x-wc-webhook-topic'] || '';

    if (topic.includes('product.deleted') || wpProd.status === 'trash') {
      const prod = await Product.findOne({
        where: {
          [Op.or]: [
            { woocommerce_product_id: wooId },
            { wooProductId: wooId }
          ]
        }
      });
      if (prod) {
        await prod.destroy();
        await woo.writeSyncLog('Products', 'Import', 1, 0, Date.now() - startTime);
        return res.json({ success: true, message: `Product ${wooId} deleted successfully via Webhook` });
      }
      return res.json({ success: true, message: `Product ${wooId} not found, skip delete` });
    }

    // Created or Updated product
    const sku = wpProd.sku || `WOO-PROD-${wpProd.id}`;

    let categoryName = 'General';
    if (wpProd.categories && wpProd.categories.length > 0) {
      categoryName = wpProd.categories[0].name;
    }

    let imageUrl = '';
    if (wpProd.images && wpProd.images.length > 0) {
      imageUrl = wpProd.images[0].src;
    }

    let galleryImagesList = [];
    if (wpProd.images && wpProd.images.length > 1) {
      galleryImagesList = wpProd.images.slice(1).map(img => img.src);
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
      name: wpProd.name || 'WooCommerce Product',
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
      woocommerce_product_id: wooId,
      wooProductId: wooId,
      brand: brandName,
      galleryImages: JSON.stringify(galleryImagesList),
      dimensions: dimensionsText,
      stockStatus: wpProd.stock_status || 'instock',
      woocommerce_last_modified: wpModified,
      woocommerce_sync_status: 'synced',
      woocommerce_permalink: wpProd.permalink || '',
    };

    let existingProduct = await Product.findOne({
      where: {
        [Op.or]: [
          { woocommerce_product_id: wooId },
          { wooProductId: wooId }
        ]
      }
    });

    if (!existingProduct && wpProd.sku) {
      existingProduct = await Product.findOne({ where: { sku: wpProd.sku } });
    }

    if (existingProduct) {
      let shouldUpdate = true;
      if (settings.wooProductSyncMode === 'ERP Master') {
        shouldUpdate = false;
      } else if (settings.wooProductSyncMode === 'Two-Way Sync') {
        const localLastMod = existingProduct.lastModifiedDate ? new Date(existingProduct.lastModifiedDate) : null;
        if (localLastMod && wpModified && wpModified.getTime() <= localLastMod.getTime()) {
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        await existingProduct.update(productData);
      }
    } else {
      await Product.create({
        ...productData,
        productType: 'trading',
        unit: 'pcs',
      });
    }

    await woo.writeSyncLog('Products', 'Import', 1, 0, Date.now() - startTime);
    res.json({ success: true, message: `Product ${wooId} processed successfully via Webhook` });
  } catch (err) {
    console.error('Webhook product sync error:', err.message);
    res.status(200).json({ success: false, message: 'Failed to process Product webhook: ' + err.message });
  }
};

exports.handleOrderWebhook = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const settings = await getSettings();
    const order = req.body;

    if (!order || !order.id) {
      return res.status(400).json({ success: false, message: 'Invalid order payload' });
    }

    const woo = new WooCommerceService(settings);
    const imported = await woo.importOrder(order, 1);

    await woo.writeSyncLog('Orders', 'Import', imported ? 1 : 0, 0, Date.now() - startTime);

    res.json({
      success: true,
      imported,
      message: imported ? `Order ${order.id} imported successfully via Webhook` : `Order ${order.id} was skipped (already exists or no matching products)`,
    });
  } catch (err) {
    console.error('Webhook order import error:', err.message);
    res.status(200).json({
      success: false,
      message: 'Failed to process WooCommerce order webhook: ' + err.message,
    });
  }
};

exports.handleCustomerWebhook = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const settings = await getSettings();
    const wooCust = req.body;

    if (!wooCust || !wooCust.id) {
      return res.status(400).json({ success: false, message: 'Invalid customer payload' });
    }

    const woo = new WooCommerceService(settings);
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

    await woo.writeSyncLog('Customers', 'Import', 1, 0, Date.now() - startTime);
    res.json({ success: true, message: `Customer ${wooCust.id} processed successfully via Webhook` });
  } catch (err) {
    console.error('Webhook customer sync error:', err.message);
    res.status(200).json({ success: false, message: 'Failed to process Customer webhook: ' + err.message });
  }
};

exports.handleInventoryWebhook = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const settings = await getSettings();
    const wpProd = req.body;

    if (!wpProd || !wpProd.id) {
      return res.status(400).json({ success: false, message: 'Invalid product payload' });
    }

    const woo = new WooCommerceService(settings);
    const wooId = String(wpProd.id);
    const stock = wpProd.stock_quantity;

    if (settings.wooInventorySyncMode !== 'ERP Master' && stock !== undefined && stock !== null) {
      const product = await Product.findOne({
        where: {
          [Op.or]: [
            { woocommerce_product_id: wooId },
            { wooProductId: wooId }
          ]
        }
      });

      if (product) {
        product.stock = Math.max(0, Math.round(Number(stock)));
        await product.save();
        console.log(`[Webhook Stock Sync] Webhook updated product ${product.sku} stock to ${stock}`);
        await woo.writeSyncLog('Inventory', 'Import', 1, 0, Date.now() - startTime);
        return res.json({ success: true, message: `Inventory for product ${wooId} updated to ${stock}` });
      }
    }

    res.json({ success: true, message: `Inventory webhook received for product ${wooId}, no changes made` });
  } catch (err) {
    console.error('Webhook inventory sync error:', err.message);
    res.status(200).json({ success: false, message: 'Failed to process Inventory webhook: ' + err.message });
  }
};

exports.getSyncLogs = async (req, res, next) => {
  try {
    const { module, action, fromDate, toDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (module) {
      query.module = module;
    }
    if (action) {
      query.action = action;
    }
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date[Op.gte] = fromDate;
      if (toDate) query.date[Op.lte] = toDate;
    }

    const SyncLog = require('../models/SyncLog');
    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await SyncLog.findAndCountAll({
      where: query,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      logs: rows,
      total: count,
      pages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
    });
  } catch (err) {
    next(err);
  }
};
