const IntegrationExportCredential = require('../models/IntegrationExportCredential');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const IntegrationCatalogue = require('../models/IntegrationCatalogue');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookLog = require('../models/WebhookLog');
const ApiAuditLog = require('../models/ApiAuditLog');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const ManufacturingEntry = require('../models/ManufacturingEntry');
const StockMovement = require('../models/StockMovement');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');

// Helper to generate keys and secrets
const generateKeys = (env = 'Live') => {
  const prefix = env === 'Test' ? 'ao_test_' : 'ao_live_';
  const apiKey = prefix + crypto.randomBytes(24).toString('hex');
  const apiSecret = 'whsec_' + crypto.randomBytes(20).toString('hex');
  return { apiKey, apiSecret };
};

// Helper to dynamically filter by tenant if supported by the model
const filterTenant = (model, where, tenantId) => {
  if (model.rawAttributes && model.rawAttributes.tenantId) {
    where.tenantId = tenantId || 1;
  }
  return where;
};

// Generic query parser for search, sort, filter, paginate
const parseQueryParams = (req, searchFields = [], model = null) => {
  const { page = 1, limit = 10, search, sortBy, sortOrder = 'DESC', startDate, endDate, status, updated_since, ...filters } = req.query;
  let where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(endDate);
  }

  if (updated_since) {
    where.updatedAt = {
      [Op.gte]: new Date(updated_since)
    };
  }

  if (status) {
    where.status = status;
  }

  // Remove empty values from filters
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== '') {
      where[key] = filters[key];
    }
  });

  if (search && searchFields.length > 0) {
    where[Op.or] = searchFields.map(field => ({
      [field]: { [Op.like]: `%${search}%` }
    }));
  }

  if (model) {
    where = filterTenant(model, where, req.tenantId);
  }

  const parsedLimit = parseInt(limit, 10);
  const parsedPage = parseInt(page, 10);
  const offset = (parsedPage - 1) * parsedLimit;

  const order = [];
  if (sortBy) {
    order.push([sortBy, sortOrder.toUpperCase()]);
  } else {
    order.push(['createdAt', 'DESC']);
  }

  return { where, limit: parsedLimit, offset, order, page: parsedPage };
};

const sendStandardResponse = (res, data, count, page, limit) => {
  const pages = Math.ceil(count / limit);
  return res.json({
    success: true,
    data,
    pagination: {
      total: count,
      page,
      limit,
      pages
    },
    meta: {
      timestamp: new Date()
    }
  });
};

// ==========================================
// DEVELOPER CREDENTIALS ADMINISTRATION
// ==========================================

exports.createExportCredential = async (req, res, next) => {
  try {
    const { name, description, environment = 'Live', permissions, allowedIps, rateLimitCount } = req.body;
    const tenantId = req.user?.tenantId || 1;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Credential Name is required' });
    }

    const { apiKey, apiSecret } = generateKeys(environment);

    const cred = await IntegrationExportCredential.create({
      name,
      description: description || null,
      apiKey,
      apiSecret,
      webhookSecret: apiSecret,
      allowedIps: allowedIps || null,
      rateLimitCount: rateLimitCount || 60,
      status: 'Active',
      environment,
      permissions: permissions ? JSON.stringify(permissions) : null,
      createdBy: req.user?.name || 'Admin',
      tenantId
    });

    res.status(201).json({
      success: true,
      message: '✓ Developer API Key generated successfully.',
      credential: {
        id: cred.id,
        name: cred.name,
        description: cred.description,
        apiKey: cred.apiKey,
        apiSecret: cred.apiSecret,
        webhookSecret: cred.webhookSecret,
        allowedIps: cred.allowedIps,
        rateLimitCount: cred.rateLimitCount,
        environment: cred.environment,
        permissions: cred.permissions ? JSON.parse(cred.permissions) : {},
        status: cred.status,
        createdBy: cred.createdBy
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.listExportCredentials = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const credentials = await IntegrationExportCredential.findAll({ where: { tenantId } });
    
    const mapped = credentials.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      apiKey: c.apiKey,
      apiSecret: c.apiSecret,
      webhookSecret: c.webhookSecret,
      status: c.status,
      allowedIps: c.allowedIps,
      rateLimitCount: c.rateLimitCount,
      environment: c.environment,
      permissions: c.permissions ? JSON.parse(c.permissions) : {},
      createdBy: c.createdBy,
      lastUsed: c.lastUsed,
      createdAt: c.createdAt
    }));

    res.json({ success: true, credentials: mapped });
  } catch (err) {
    next(err);
  }
};

exports.deleteExportCredential = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || 1;

    const cred = await IntegrationExportCredential.findOne({ where: { id, tenantId } });
    if (!cred) {
      return res.status(404).json({ success: false, message: 'Developer API credential not found.' });
    }

    await cred.destroy();
    res.json({ success: true, message: '✓ Developer API key deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

exports.regenerateExportCredential = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || 1;

    const cred = await IntegrationExportCredential.findOne({ where: { id, tenantId } });
    if (!cred) {
      return res.status(404).json({ success: false, message: 'Developer API credential not found.' });
    }

    const { apiKey, apiSecret } = generateKeys(cred.environment);
    cred.apiKey = apiKey;
    cred.apiSecret = apiSecret;
    cred.webhookSecret = apiSecret;
    await cred.save();

    res.json({
      success: true,
      message: '✓ API Key and Webhook secret regenerated successfully.',
      credential: {
        id: cred.id,
        name: cred.name,
        apiKey: cred.apiKey,
        apiSecret: cred.apiSecret,
        webhookSecret: cred.webhookSecret,
        status: cred.status,
        environment: cred.environment
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// PORTAL ANALYTICS & AUDIT LOGS
// ==========================================

exports.getAnalyticsDashboard = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const totalRequests = await ApiAuditLog.count({ where: { tenantId } });
    
    const successCount = await ApiAuditLog.count({ where: { tenantId, status: { [Op.lt]: 400 } } });
    const failedCount = await ApiAuditLog.count({ where: { tenantId, status: { [Op.gte]: 400 } } });

    const successPct = totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : '100.0';
    const failedPct = totalRequests > 0 ? ((failedCount / totalRequests) * 100).toFixed(1) : '0.0';

    const avgRes = await ApiAuditLog.findAll({
      attributes: [[sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration']],
      where: { tenantId },
      raw: true
    });
    const averageResponse = avgRes[0]?.avgDuration ? Math.round(Number(avgRes[0].avgDuration)) : 0;

    // Top API endpoints (group by method + endpoint)
    const topApis = await ApiAuditLog.findAll({
      attributes: ['endpoint', 'method', [sequelize.fn('COUNT', sequelize.col('id')), 'reqCount']],
      where: { tenantId },
      group: ['endpoint', 'method'],
      order: [[sequelize.literal('reqCount'), 'DESC']],
      limit: 10,
      raw: true
    });

    // Top Consumers (group by keyName)
    const topConsumers = await ApiAuditLog.findAll({
      attributes: ['keyName', [sequelize.fn('COUNT', sequelize.col('id')), 'reqCount']],
      where: { tenantId },
      group: ['keyName'],
      order: [[sequelize.literal('reqCount'), 'DESC']],
      limit: 10,
      raw: true
    });

    // Daily Traffic (last 14 days)
    const dailyData = await ApiAuditLog.findAll({
      attributes: [
        [sequelize.fn('date', sequelize.col('createdAt')), 'dateStr'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'reqCount']
      ],
      where: { tenantId },
      group: [sequelize.fn('date', sequelize.col('createdAt'))],
      order: [[sequelize.literal('dateStr'), 'ASC']],
      limit: 14,
      raw: true
    });

    // Estimated Bandwidth: simulate count * 2.5KB avg response size
    const bandwidthUsage = totalRequests > 0 ? (totalRequests * 2.5) : 0; // KB

    res.json({
      success: true,
      stats: {
        totalRequests,
        successCount,
        failedCount,
        successPct,
        failedPct,
        averageResponse,
        bandwidthUsage,
        topConsumers,
        topApis,
        dailyTraffic: dailyData
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const { where, limit, offset, order, page } = parseQueryParams(req, ['keyName', 'endpoint', 'errorMessage', 'ipAddress'], ApiAuditLog);
    where.tenantId = tenantId;

    const { count, rows } = await ApiAuditLog.findAndCountAll({
      where,
      limit,
      offset,
      order
    });

    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

// ==========================================
// PUBLIC HEALTH CHECK FOR SAAS / EXTERNAL LINKS
// ==========================================

exports.getHealth = async (req, res, next) => {
  try {
    let dbStatus = 'connected';
    try {
      const connectDB = require('../config/db');
      await connectDB.sequelize.authenticate();
    } catch (e) {
      dbStatus = 'disconnected';
    }
    res.json({
      success: true,
      status: "online",
      database: dbStatus,
      version: "2.0.0",
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// SECURE EXTERNAL DATA CRUD OPERATIONS
// ==========================================

// --- PRODUCTS ---
exports.getProducts = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['name', 'sku', 'category', 'brand'], Product);

    const { count, rows } = await Product.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Product, data, req.tenantId);
    const prod = await Product.create(data);
    res.status(201).json({ success: true, message: 'Product created successfully.', product: prod, data: prod });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Product, { id }, req.tenantId);
    const prod = await Product.findOne({ where });
    if (!prod) return res.status(404).json({ success: false, message: 'Product not found.' });

    await prod.update(req.body);
    res.json({ success: true, message: 'Product updated successfully.', product: prod, data: prod });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Product, { id }, req.tenantId);
    const prod = await Product.findOne({ where });
    if (!prod) return res.status(404).json({ success: false, message: 'Product not found.' });

    await prod.destroy();
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- CUSTOMERS ---
exports.getCustomers = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['name', 'phone', 'email', 'businessName'], Customer);

    const { count, rows } = await Customer.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Customer, data, req.tenantId);
    const customer = await Customer.create(data);
    res.status(201).json({ success: true, message: 'Customer created successfully.', customer, data: customer });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Customer, { id }, req.tenantId);
    const customer = await Customer.findOne({ where });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    await customer.update(req.body);
    res.json({ success: true, message: 'Customer updated successfully.', customer, data: customer });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Customer, { id }, req.tenantId);
    const customer = await Customer.findOne({ where });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    await customer.destroy();
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- ORDERS ---
exports.getOrders = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['orderNumber', 'customerName', 'phone'], Order);

    const { count, rows } = await Order.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Order, data, req.tenantId);
    if (!data.orderNumber) {
      data.orderNumber = 'EXT-ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    if (data.items && typeof data.items === 'object') {
      data.items = JSON.stringify(data.items);
    }
    const order = await Order.create(data);
    res.status(201).json({ success: true, message: 'Order created successfully.', order, data: order });
  } catch (err) {
    next(err);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Order, { id }, req.tenantId);
    const order = await Order.findOne({ where });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const data = req.body;
    if (data.items && typeof data.items === 'object') {
      data.items = JSON.stringify(data.items);
    }
    await order.update(data);
    res.json({ success: true, message: 'Order updated successfully.', order, data: order });
  } catch (err) {
    next(err);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Order, { id }, req.tenantId);
    const order = await Order.findOne({ where });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    await order.destroy();
    res.json({ success: true, message: 'Order deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- INVOICES ---
exports.getInvoices = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['invoiceNumber', 'customerName', 'paymentStatus'], Invoice);

    const { count, rows } = await Invoice.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createInvoice = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Invoice, data, req.tenantId);
    const invoice = await Invoice.create(data);
    res.status(201).json({ success: true, message: 'Invoice created successfully.', invoice, data: invoice });
  } catch (err) {
    next(err);
  }
};

exports.updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Invoice, { id }, req.tenantId);
    const invoice = await Invoice.findOne({ where });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    await invoice.update(req.body);
    res.json({ success: true, message: 'Invoice updated successfully.', invoice, data: invoice });
  } catch (err) {
    next(err);
  }
};

exports.deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Invoice, { id }, req.tenantId);
    const invoice = await Invoice.findOne({ where });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    await invoice.destroy();
    res.json({ success: true, message: 'Invoice deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- INVENTORY ---
exports.getInventory = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['name', 'sku'], Product);

    // Returns stock levels grouped under products
    const { count, rows } = await Product.findAndCountAll({
      attributes: ['id', 'name', 'sku', 'stock', 'category', 'supplier'],
      where,
      limit,
      offset,
      order
    });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.adjustInventory = async (req, res, next) => {
  try {
    const { productId, quantity, type, note } = req.body;
    const tenantId = req.tenantId || 1;

    if (!productId || quantity === undefined || !type) {
      return res.status(400).json({ success: false, message: 'productId, quantity changed, and type (Adjustment/Receipt/etc) are required.' });
    }

    const where = filterTenant(Product, { id: productId }, tenantId);
    const product = await Product.findOne({ where });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const prevStock = Number(product.stock || 0);
    const qtyChange = Number(quantity);
    product.stock = prevStock + qtyChange;
    await product.save();

    const movementData = {
      productId,
      quantity: qtyChange,
      type,
      note: note || 'External API Adjustment'
    };
    filterTenant(StockMovement, movementData, tenantId);

    const movement = await StockMovement.create(movementData);

    res.status(201).json({
      success: true,
      message: '✓ Inventory level adjusted successfully.',
      currentStock: product.stock,
      movement
    });
  } catch (err) {
    next(err);
  }
};

// --- PURCHASES ---
exports.getPurchases = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['purchaseNumber', 'supplierName', 'paymentStatus'], Purchase);

    const { count, rows } = await Purchase.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Purchase, data, req.tenantId);
    const purchase = await Purchase.create(data);
    res.status(201).json({ success: true, message: 'Purchase record created successfully.', purchase, data: purchase });
  } catch (err) {
    next(err);
  }
};

exports.updatePurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Purchase, { id }, req.tenantId);
    const purchase = await Purchase.findOne({ where });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    await purchase.update(req.body);
    res.json({ success: true, message: 'Purchase record updated successfully.', purchase, data: purchase });
  } catch (err) {
    next(err);
  }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Purchase, { id }, req.tenantId);
    const purchase = await Purchase.findOne({ where });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    await purchase.destroy();
    res.json({ success: true, message: 'Purchase record deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- MANUFACTURING ---
exports.getManufacturing = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['batchNumber', 'recipeName'], ManufacturingEntry);

    const { count, rows } = await ManufacturingEntry.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createManufacturing = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(ManufacturingEntry, data, req.tenantId);
    const entry = await ManufacturingEntry.create(data);
    res.status(201).json({ success: true, message: 'Manufacturing entry recorded successfully.', entry, data: entry });
  } catch (err) {
    next(err);
  }
};

exports.updateManufacturing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(ManufacturingEntry, { id }, req.tenantId);
    const entry = await ManufacturingEntry.findOne({ where });
    if (!entry) return res.status(404).json({ success: false, message: 'Manufacturing entry not found.' });

    await entry.update(req.body);
    res.json({ success: true, message: 'Manufacturing entry updated successfully.', entry, data: entry });
  } catch (err) {
    next(err);
  }
};

exports.deleteManufacturing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(ManufacturingEntry, { id }, req.tenantId);
    const entry = await ManufacturingEntry.findOne({ where });
    if (!entry) return res.status(404).json({ success: false, message: 'Manufacturing entry not found.' });

    await entry.destroy();
    res.json({ success: true, message: 'Manufacturing entry deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- SUPPLIERS ---
exports.getSuppliers = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['name', 'phone', 'contactPerson'], Supplier);

    const { count, rows } = await Supplier.findAndCountAll({ where, limit, offset, order });
    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const data = req.body;
    filterTenant(Supplier, data, req.tenantId);
    const supplier = await Supplier.create(data);
    res.status(201).json({ success: true, message: 'Supplier created successfully.', supplier, data: supplier });
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Supplier, { id }, req.tenantId);
    const supplier = await Supplier.findOne({ where });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    await supplier.update(req.body);
    res.json({ success: true, message: 'Supplier updated successfully.', supplier, data: supplier });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const where = filterTenant(Supplier, { id }, req.tenantId);
    const supplier = await Supplier.findOne({ where });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    await supplier.destroy();
    res.json({ success: true, message: 'Supplier deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// --- OUTSTANDING (LEGACY COMPAT) ---
exports.getOutstanding = async (req, res, next) => {
  try {
    const customer = req.query.customer || '';

    if (!customer) {
      return res.status(400).json({ success: false, message: 'customer name or phone query is required.' });
    }

    const custWhere = {
      [Op.or]: [
        { name: customer },
        { phone: customer }
      ]
    };
    filterTenant(Customer, custWhere, req.tenantId);

    const customerObj = await Customer.findOne({ where: custWhere });

    if (!customerObj) {
      return res.status(404).json({ success: false, message: `Customer "${customer}" not found.` });
    }

    const invWhere = { customerId: customerObj.id };
    filterTenant(Invoice, invWhere, req.tenantId);
    const invoices = await Invoice.findAll({ where: invWhere });
    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal || inv.total || 0), 0);

    const payWhere = { customerId: customerObj.id };
    filterTenant(Payment, payWhere, req.tenantId);
    const payments = await Payment.findAll({
      where: payWhere,
      order: [['date', 'DESC']]
    });
    const receivedAmount = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
    const pendingAmount = totalSales - receivedAmount;
    
    let lastPaymentDate = null;
    if (payments.length > 0) {
      const d = new Date(payments[0].date);
      if (!isNaN(d.getTime())) {
        lastPaymentDate = d.toISOString().split('T')[0];
      }
    }

    const outputData = {
      customer: customerObj.name,
      totalSales,
      receivedAmount,
      pendingAmount,
      lastPaymentDate
    };

    res.json({
      success: true,
      ...outputData,
      data: outputData
    });
  } catch (err) {
    next(err);
  }
};

// --- REPORTS ---
exports.getReports = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    
    const invWhere = filterTenant(Invoice, {}, tenantId);
    const payWhere = filterTenant(Payment, {}, tenantId);

    const totalSales = await Invoice.sum('grandTotal', { where: invWhere }) || 0;
    const totalReceipts = await Payment.sum('amount', { where: payWhere }) || 0;
    const pendingOutstanding = totalSales - totalReceipts;

    const summaryData = {
      totalSales,
      totalReceipts,
      pendingOutstanding,
      generatedAt: new Date()
    };

    res.json({
      success: true,
      summary: summaryData,
      data: summaryData
    });
  } catch (err) {
    next(err);
  }
};

// --- ANALYTICS ---
exports.getAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    
    const prodWhere = filterTenant(Product, {}, tenantId);
    const custWhere = filterTenant(Customer, {}, tenantId);
    const ordWhere = filterTenant(Order, {}, tenantId);
    const invWhere = filterTenant(Invoice, {}, tenantId);

    const productCount = await Product.count({ where: prodWhere });
    const customerCount = await Customer.count({ where: custWhere });
    const orderCount = await Order.count({ where: ordWhere });
    const invoiceCount = await Invoice.count({ where: invWhere });

    const result = {
      productCount,
      customerCount,
      orderCount,
      invoiceCount,
      retrievedAt: new Date()
    };

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// --- CATALOGUES ---
exports.getCatalogues = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    const where = filterTenant(IntegrationCatalogue, {}, tenantId);
    const catalogues = await IntegrationCatalogue.findAll({ where });
    res.json({ success: true, count: catalogues.length, catalogues, data: catalogues });
  } catch (err) {
    next(err);
  }
};

// --- SETTINGS ---
exports.getSettings = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    const where = filterTenant(Settings, {}, tenantId);
    const settings = await Settings.findOne({ where }) || await Settings.create(where);
    
    const settingsData = {
      companyName: settings?.companyName || 'Amudhasurabiy Organics',
      address: settings?.address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      websiteUrl: settings?.websiteUrl || '',
      gstNumber: settings?.gstNumber || ''
    };

    res.json({
      success: true,
      ...settingsData,
      data: settingsData
    });
  } catch (err) {
    next(err);
  }
};

// --- WHATSAPP ---
exports.sendWhatsApp = async (req, res, next) => {
  try {
    const { phone, message, type = 'Notification' } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'phone and message text are required.' });
    }

    const result = await whatsappService.sendMessage(phone, message, null, type);
    res.json({
      success: true,
      message: '✓ WhatsApp message dispatched successfully via external API.',
      logId: result.id
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// WEBHOOK ENDPOINT REGISTRATIONS (CRUD)
// ==========================================

exports.createWebhookEndpoint = async (req, res, next) => {
  try {
    const { name, url, description, events } = req.body;
    const tenantId = req.tenantId || 1;

    if (!name || !url || !events) {
      return res.status(400).json({ success: false, message: 'name, url, and subscribed events are required.' });
    }

    const secret = 'whsec_' + crypto.randomBytes(20).toString('hex');

    const ep = await WebhookEndpoint.create({
      name,
      url,
      description: description || null,
      events: Array.isArray(events) ? events.join(',') : events,
      secret,
      status: 'Active',
      tenantId
    });

    res.status(201).json({
      success: true,
      message: '✓ Webhook endpoint registered successfully.',
      endpoint: {
        id: ep.id,
        name: ep.name,
        url: ep.url,
        description: ep.description,
        events: ep.events.split(','),
        secret: ep.secret,
        status: ep.status
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.listWebhookEndpoints = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    const endpoints = await WebhookEndpoint.findAll({ where: { tenantId } });
    
    const mapped = endpoints.map(ep => ({
      id: ep.id,
      name: ep.name,
      url: ep.url,
      description: ep.description,
      events: ep.events.split(','),
      secret: ep.secret,
      status: ep.status,
      createdAt: ep.createdAt
    }));

    res.json({ success: true, endpoints: mapped });
  } catch (err) {
    next(err);
  }
};

exports.updateWebhookEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ep = await WebhookEndpoint.findOne({ where: { id, tenantId: req.tenantId || 1 } });
    if (!ep) return res.status(404).json({ success: false, message: 'Webhook endpoint not found.' });

    const { name, url, description, events, status } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url;
    if (description !== undefined) data.description = description;
    if (events !== undefined) data.events = Array.isArray(events) ? events.join(',') : events;
    if (status !== undefined) data.status = status;

    await ep.update(data);

    res.json({
      success: true,
      message: '✓ Webhook endpoint updated successfully.',
      endpoint: {
        id: ep.id,
        name: ep.name,
        url: ep.url,
        description: ep.description,
        events: ep.events.split(','),
        secret: ep.secret,
        status: ep.status
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteWebhookEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ep = await WebhookEndpoint.findOne({ where: { id, tenantId: req.tenantId || 1 } });
    if (!ep) return res.status(404).json({ success: false, message: 'Webhook endpoint not found.' });

    await ep.destroy();
    res.json({ success: true, message: '✓ Webhook endpoint deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// WEBHOOK DELIVERY LOGS & MANUAL RETRIES
// ==========================================

exports.listWebhookLogs = async (req, res, next) => {
  try {
    const { where, limit, offset, order, page } = parseQueryParams(req, ['event', 'status', 'errorMessage'], WebhookLog);

    const { count, rows } = await WebhookLog.findAndCountAll({
      where,
      limit,
      offset,
      order
    });

    sendStandardResponse(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

exports.retryWebhookLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await WebhookLog.findOne({ where: { id, tenantId: req.tenantId || 1 } });
    if (!log) return res.status(404).json({ success: false, message: 'Webhook delivery log not found.' });

    // Instantly reset schedule to trigger now
    log.nextRetryAt = new Date();
    log.status = 'Pending';
    await log.save();

    // Trigger webhook dispatcher service call
    const webhookService = require('../services/webhookService');
    const success = await webhookService.dispatchSingleLog(log);

    if (success) {
      res.json({ success: true, message: '✓ Webhook retried and dispatched successfully.' });
    } else {
      res.status(500).json({ success: false, message: 'Webhook dispatch retry failed. Check webhook execution logs for details.' });
    }
  } catch (err) {
    next(err);
  }
};
