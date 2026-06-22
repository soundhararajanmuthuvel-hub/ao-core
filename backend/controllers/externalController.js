const IntegrationExportCredential = require('../models/IntegrationExportCredential');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const IntegrationCatalogue = require('../models/IntegrationCatalogue');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');
const { Op } = require('sequelize');

// Helper to generate new credentials
const generateKeys = () => {
  const apiKey = 'ao_live_' + crypto.randomBytes(24).toString('hex');
  const apiSecret = 'wh_' + crypto.randomBytes(16).toString('hex');
  return { apiKey, apiSecret };
};

// ==========================================
// DEVELOPER CREDENTIALS ADMINISTRATION (Admin role)
// ==========================================

exports.createExportCredential = async (req, res, next) => {
  try {
    const { name, allowedIps, rateLimitCount, expiryDate } = req.body;
    const tenantId = req.user?.tenantId || 1;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Credential Name is required' });
    }

    const { apiKey, apiSecret } = generateKeys();

    const cred = await IntegrationExportCredential.create({
      name,
      apiKey,
      apiSecret,
      allowedIps: allowedIps || null,
      rateLimitCount: rateLimitCount || 60,
      expiryDate: expiryDate || null,
      status: 'Active',
      tenantId
    });

    res.status(201).json({
      success: true,
      message: '✓ External Developer API Key generated successfully.',
      credential: {
        id: cred.id,
        name: cred.name,
        apiKey: cred.apiKey,
        apiSecret: cred.apiSecret,
        allowedIps: cred.allowedIps,
        rateLimitCount: cred.rateLimitCount,
        expiryDate: cred.expiryDate,
        status: cred.status
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
    res.json({ success: true, credentials });
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

    const { apiKey, apiSecret } = generateKeys();
    cred.apiKey = apiKey;
    cred.apiSecret = apiSecret;
    await cred.save();

    res.json({
      success: true,
      message: '✓ API Key and Webhook secret regenerated successfully.',
      credential: {
        id: cred.id,
        name: cred.name,
        apiKey: cred.apiKey,
        apiSecret: cred.apiSecret,
        allowedIps: cred.allowedIps,
        rateLimitCount: cred.rateLimitCount,
        expiryDate: cred.expiryDate,
        status: cred.status
      }
    });
  } catch (err) {
    next(err);
  }
};


// ==========================================
// SECURE EXTERNAL DATA EXPORTS (API Key authenticated)
// ==========================================

exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.findAll();
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.findAll();
    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll();
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

exports.getInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.findAll();
    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    next(err);
  }
};

exports.getCatalogues = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || 1;
    const catalogues = await IntegrationCatalogue.findAll({ where: { tenantId } });
    res.json({ success: true, count: catalogues.length, catalogues });
  } catch (err) {
    next(err);
  }
};

exports.getOutstanding = async (req, res, next) => {
  try {
    const customer = req.query.customer || '';

    if (!customer) {
      return res.status(400).json({ success: false, message: 'customer name or phone query is required.' });
    }

    const customerObj = await Customer.findOne({
      where: {
        [Op.or]: [
          { name: customer },
          { phone: customer }
        ]
      }
    });

    if (!customerObj) {
      return res.status(404).json({ success: false, message: `Customer "${customer}" not found.` });
    }

    // Invoices list for total sales calculation
    const invoices = await Invoice.findAll({
      where: { customerId: customerObj.id }
    });
    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal || inv.total || 0), 0);

    // Payments list for received amount calculation
    const payments = await Payment.findAll({
      where: { customerId: customerObj.id },
      order: [['date', 'DESC']]
    });
    const receivedAmount = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
    const pendingAmount = totalSales - receivedAmount;
    
    // Convert payment date
    let lastPaymentDate = null;
    if (payments.length > 0) {
      const d = new Date(payments[0].date);
      if (!isNaN(d.getTime())) {
        lastPaymentDate = d.toISOString().split('T')[0];
      }
    }

    // Output requested exact JSON structure
    res.json({
      customer: customerObj.name,
      totalSales,
      receivedAmount,
      pendingAmount,
      lastPaymentDate
    });
  } catch (err) {
    next(err);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const totalSales = await Invoice.sum('grandTotal') || 0;
    const totalReceipts = await Payment.sum('amount') || 0;
    const pendingOutstanding = totalSales - totalReceipts;

    res.json({
      success: true,
      summary: {
        totalSales,
        totalReceipts,
        pendingOutstanding,
        generatedAt: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne() || await Settings.create({});
    res.json({
      success: true,
      companyName: settings?.companyName || 'Amudhasurabiy Organics',
      address: settings?.address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      websiteUrl: settings?.websiteUrl || '',
      gstNumber: settings?.gstNumber || ''
    });
  } catch (err) {
    next(err);
  }
};

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

exports.createOrder = async (req, res, next) => {
  try {
    const { customerName, phone, amount, items, orderNumber } = req.body;

    if (!customerName || !amount) {
      return res.status(400).json({ success: false, message: 'customerName and amount are required.' });
    }

    const orderNum = orderNumber || 'EXT-ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const order = await Order.create({
      orderNumber: orderNum,
      customerName,
      phone: phone || '',
      amount: Number(amount),
      items: typeof items === 'object' ? JSON.stringify(items) : (items || '[]'),
      status: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: '✓ Order created successfully via developer API.',
      order
    });
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, gstNumber, customerType } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'customer name is required.' });
    }

    const customer = await Customer.create({
      name,
      phone: phone || '',
      email: email || '',
      address: address || '',
      gstNumber: gstNumber || '',
      customerType: customerType || 'Retail Shop'
    });

    res.status(201).json({
      success: true,
      message: '✓ Customer profile created successfully via developer API.',
      customer
    });
  } catch (err) {
    next(err);
  }
};
