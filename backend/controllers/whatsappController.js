const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppLog = require('../models/WhatsAppLog');
const Customer = require('../models/Customer');
const whatsappService = require('../services/whatsappService');
const { logActivity } = require('../utils/helpers');
const { Op } = require('sequelize');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

exports.getSettings = async (req, res, next) => {
  try {
    let settings = await WhatsAppSettings.findOne();
    if (!settings) {
      settings = await WhatsAppSettings.create({
        crmBaseUrl: 'http://localhost:5000/api/whatsapp/mock-crm',
        status: 'Disconnected'
      });
    }

    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const apiKeyDecrypted = whatsappService.decrypt(settings.crmApiKey) || '';
    const secretDecrypted = whatsappService.decrypt(settings.crmSecret) || '';

    res.json({
      success: true,
      settings: {
        id: settings.id,
        crmBaseUrl: settings.crmBaseUrl || '',
        crmApiKey: isSuperAdmin ? apiKeyDecrypted : (settings.crmApiKey ? '********' : ''),
        crmSecret: isSuperAdmin ? secretDecrypted : (settings.crmSecret ? '********' : ''),
        webhookUrl: settings.webhookUrl || '',
        status: settings.status,
        // Legacy fallbacks for compatibility
        provider: settings.provider || 'CRM WhatsApp',
        apiUrl: settings.crmBaseUrl || '',
        apiKey: isSuperAdmin ? apiKeyDecrypted : (settings.crmApiKey ? '********' : ''),
        instanceId: isSuperAdmin ? secretDecrypted : (settings.crmSecret ? '********' : '')
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can edit WhatsApp settings' });
    }

    const { crmBaseUrl, crmApiKey, crmSecret, webhookUrl, provider, apiUrl, apiKey, instanceId } = req.body;
    let settings = await WhatsAppSettings.findOne();
    if (!settings) {
      settings = new WhatsAppSettings();
    }

    settings.crmBaseUrl = crmBaseUrl || apiUrl || 'http://localhost:5000/api/whatsapp/mock-crm';
    settings.webhookUrl = webhookUrl || '';
    settings.provider = provider || 'CRM WhatsApp';
    settings.apiUrl = settings.crmBaseUrl; // sync legacy

    if (crmApiKey && crmApiKey !== '********') {
      settings.crmApiKey = whatsappService.encrypt(crmApiKey);
      settings.apiKey = settings.crmApiKey; // sync legacy
    } else if (apiKey && apiKey !== '********') {
      settings.crmApiKey = whatsappService.encrypt(apiKey);
      settings.apiKey = settings.crmApiKey;
    }

    if (crmSecret && crmSecret !== '********') {
      settings.crmSecret = whatsappService.encrypt(crmSecret);
      settings.instanceId = settings.crmSecret; // sync legacy
    } else if (instanceId && instanceId !== '********') {
      settings.crmSecret = whatsappService.encrypt(instanceId);
      settings.instanceId = settings.crmSecret;
    }

    await settings.save();
    await logActivity(req.user.id, 'update', 'settings', 'Updated WhatsApp Integration configurations');

    res.json({
      success: true,
      message: 'WhatsApp configurations saved successfully.',
      settings: {
        id: settings.id,
        crmBaseUrl: settings.crmBaseUrl,
        webhookUrl: settings.webhookUrl,
        status: settings.status
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can test WhatsApp settings' });
    }

    const settings = await WhatsAppSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'WhatsApp configurations not found. Please save settings first.' });
    }

    const crmBaseUrl = settings.crmBaseUrl || 'http://localhost:5000/api/whatsapp/mock-crm';
    const crmApiKey = settings.crmApiKey ? whatsappService.decrypt(settings.crmApiKey) : '';
    const crmSecret = settings.crmSecret ? whatsappService.decrypt(settings.crmSecret) : '';

    if (!crmApiKey) {
      return res.status(400).json({ success: false, message: 'API Key Missing' });
    }

    let isConnected = false;
    let details = '';

    if (crmBaseUrl.includes('localhost') || crmBaseUrl.includes('127.0.0.1')) {
      isConnected = true;
      details = 'Connection simulated successfully for mock CRM address.';
    } else {
      try {
        const pingUrl = crmBaseUrl.endsWith('/') ? `${crmBaseUrl}status` : `${crmBaseUrl}/status`;
        const headers = {
          'X-CRM-API-KEY': crmApiKey,
          'X-CRM-SECRET': crmSecret
        };
        const response = await axios.get(pingUrl, { headers, timeout: 5000 });
        if (response.status === 200) {
          isConnected = true;
          details = 'Successfully connected to Custom CRM WhatsApp API.';
        } else {
          details = `Unexpected response code: ${response.status}`;
        }
      } catch (pingErr) {
        console.warn('CRM WhatsApp status ping failed, attempting base GET:', pingErr.message);
        try {
          const response = await axios.get(crmBaseUrl, {
            headers: {
              'X-CRM-API-KEY': crmApiKey,
              'X-CRM-SECRET': crmSecret
            },
            timeout: 5000
          });
          if (response.status === 200) {
            isConnected = true;
            details = 'Successfully connected to Custom CRM WhatsApp API.';
          } else {
            details = `CRM API Rejected Request: Status ${response.status}`;
          }
        } catch (baseErr) {
          details = `Network Error: Connection failed (${baseErr.message})`;
        }
      }
    }

    settings.status = isConnected ? 'Connected' : 'Disconnected';
    await settings.save();

    res.json({
      success: isConnected,
      status: settings.status,
      message: details
    });
  } catch (err) {
    next(err);
  }
};

exports.sendInvoicePdf = async (req, res, next) => {
  const invoiceId = req.body.invoiceId || req.body.saleId;
  const customerPhone = req.body.phone || req.body.customerPhone;
  const messageText = req.body.message || 'Please find attached your invoice.';
  const customerId = req.body.customerId;
  const messageType = req.body.messageType || 'Invoice';
  let pdfPath = req.file ? req.file.path : null;

  const Invoice = require('../models/Invoice');
  const Customer = require('../models/Customer');
  const { getSettings } = require('../utils/helpers');
  const { generateInvoicePdf } = require('../utils/invoiceGenerator');

  try {
    // Validations
    const settings = await WhatsAppSettings.findOne();
    if (!settings || settings.status !== 'Connected') {
      return res.status(400).json({ success: false, message: 'CRM Not Connected' });
    }
    if (!settings.crmApiKey) {
      return res.status(400).json({ success: false, message: 'API Key Missing' });
    }

    let invoice = null;
    if (invoiceId) {
      invoice = await Invoice.findByPk(invoiceId, {
        include: [
          { model: Customer, as: 'customer' },
          { association: 'items' }
        ]
      });
    }

    if (!invoice && customerId) {
      invoice = await Invoice.findOne({
        where: { customerId },
        order: [['createdAt', 'DESC']],
        include: [
          { model: Customer, as: 'customer' },
          { association: 'items' }
        ]
      });
    }

    if (!invoice && invoiceId) {
      return res.status(404).json({ success: false, message: 'Invoice Not Found' });
    }

    let customer = invoice ? invoice.customer : null;
    if (!customer && customerId) {
      customer = await Customer.findByPk(customerId);
    }

    const phoneVal = customerPhone || customer?.phone;
    if (!phoneVal) {
      return res.status(400).json({ success: false, message: 'Customer Phone Missing' });
    }

    if (!pdfPath && invoice) {
      const filename = `${invoice.invoiceNumber}.pdf`;
      const targetPath = path.join(__dirname, '../uploads/invoices', filename);
      if (!fs.existsSync(targetPath)) {
        const companySettings = await getSettings();
        try {
          await generateInvoicePdf(invoice, companySettings, targetPath);
        } catch (pdfErr) {
          console.error('Invoice PDF generation failed:', pdfErr.message);
          return res.status(500).json({ success: false, message: 'PDF Generation Failed' });
        }
      }
      pdfPath = targetPath;
    }

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(500).json({ success: false, message: 'PDF Generation Failed' });
    }

    const result = await whatsappService.sendPdf(phoneVal, messageText, pdfPath, customer?.id || null, messageType, invoice?.id || null);

    // Cleanup temp Multer files
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
    }

    res.json(result);
  } catch (err) {
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
    }
    let errMsg = err.message;
    if (errMsg === 'Network Error' || errMsg === 'CRM API Rejected Request' || errMsg === 'CRM Not Connected' || errMsg === 'API Key Missing' || errMsg === 'Customer Phone Missing') {
      return res.status(500).json({ success: false, message: errMsg });
    }
    next(err);
  }
};

exports.sendDocument = async (req, res, next) => {
  const { phone, fileUrl, caption, fileName } = req.body;
  if (!phone || !fileUrl) {
    return res.status(400).json({ success: false, message: 'Recipient phone number and file URL are required' });
  }

  try {
    const settings = await WhatsAppSettings.findOne();
    if (!settings || settings.status !== 'Connected') {
      return res.status(400).json({ success: false, message: 'CRM Not Connected' });
    }
    if (!settings.crmApiKey) {
      return res.status(400).json({ success: false, message: 'API Key Missing' });
    }

    let localPath = null;
    let isTemp = false;

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      const tempDir = path.join(__dirname, '../uploads/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const ext = path.extname(fileName || fileUrl) || '.pdf';
      localPath = path.join(tempDir, `doc-${Date.now()}${ext}`);
      
      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        timeout: 15000
      });
      
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      isTemp = true;
    } else {
      const cleanPath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
      localPath = path.resolve(__dirname, '..', cleanPath);
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ success: false, message: `Local document file not found` });
      }
    }

    const cleanPhone = whatsappService.formatPhone(phone);
    const result = await whatsappService.sendPdf(cleanPhone, caption || '', localPath, null, 'Document');

    if (isTemp && localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (_) {}
    }

    res.json(result);
  } catch (err) {
    let errMsg = err.message;
    if (errMsg === 'Network Error' || errMsg === 'CRM API Rejected Request' || errMsg === 'CRM Not Connected' || errMsg === 'API Key Missing' || errMsg === 'Customer Phone Missing') {
      return res.status(500).json({ success: false, message: errMsg });
    }
    next(err);
  }
};

exports.sendQuickText = async (req, res, next) => {
  try {
    const { phone, message, customerId, messageType = 'Greeting', invoiceId } = req.body;
    
    // Validations
    const settings = await WhatsAppSettings.findOne();
    if (!settings || settings.status !== 'Connected') {
      return res.status(400).json({ success: false, message: 'CRM Not Connected' });
    }
    if (!settings.crmApiKey) {
      return res.status(400).json({ success: false, message: 'API Key Missing' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Customer Phone Missing' });
    }

    const result = await whatsappService.sendMessage(phone, message, customerId || null, messageType, invoiceId || null);
    
    res.json(result);
  } catch (err) {
    let errMsg = err.message;
    if (errMsg === 'Network Error' || errMsg === 'CRM API Rejected Request' || errMsg === 'CRM Not Connected' || errMsg === 'API Key Missing' || errMsg === 'Customer Phone Missing') {
      return res.status(500).json({ success: false, message: errMsg });
    }
    next(err);
  }
};

exports.sendTestMessage = async (req, res, next) => {
  try {
    const settings = await getActiveSettingsOrThrow();
    const testPhone = settings.phone || '917010602115';
    const testMsg = `Test WhatsApp text message from AO Core ERP at ${new Date().toLocaleString()}`;

    const result = await whatsappService.sendMessage(testPhone, testMsg, null, 'Test Message');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendTestCatalogue = async (req, res, next) => {
  try {
    const settings = await getActiveSettingsOrThrow();
    const IntegrationCatalogue = require('../models/IntegrationCatalogue');
    const catalogue = await IntegrationCatalogue.findOne();
    if (!catalogue) {
      return res.status(404).json({ success: false, message: 'Catalogue Not Found' });
    }

    const testPhone = settings.phone || '917010602115';
    const testMsg = `Test Catalogue PDF message from AO Core ERP at ${new Date().toLocaleString()}`;
    const testPdfPath = catalogue.pdfUrl || path.join(__dirname, '../uploads/temp/amudhasurabiy_brochure.pdf');

    if (!fs.existsSync(testPdfPath)) {
      const tempDir = path.dirname(testPdfPath);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(testPdfPath, 'Mock Catalogue Data');
    }

    const result = await whatsappService.sendPdf(testPhone, testMsg, testPdfPath, null, 'Catalogue');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendTestInvoice = async (req, res, next) => {
  try {
    const settings = await getActiveSettingsOrThrow();
    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findOne({ order: [['createdAt', 'DESC']] });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice Not Found' });
    }

    const testPhone = settings.phone || '917010602115';
    const testMsg = `Test Invoice PDF message from AO Core ERP at ${new Date().toLocaleString()}`;
    const targetPath = path.join(__dirname, '../uploads/invoices', `${invoice.invoiceNumber}.pdf`);

    if (!fs.existsSync(targetPath)) {
      try {
        const companySettings = await require('../utils/helpers').getSettings();
        await require('../utils/invoiceGenerator').generateInvoicePdf(invoice, companySettings, targetPath);
      } catch (pdfErr) {
        return res.status(500).json({ success: false, message: 'PDF Generation Failed' });
      }
    }

    const result = await whatsappService.sendPdf(testPhone, testMsg, targetPath, null, 'Invoice', invoice.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.retryFailed = async (req, res, next) => {
  try {
    const failedLogs = await WhatsAppLog.findAll({ where: { status: 'Failed' } });
    if (failedLogs.length === 0) {
      return res.json({ success: true, message: 'No failed messages found to retry.' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const log of failedLogs) {
      try {
        if (log.messageText.includes('PDF Attachment:') || log.messageType === 'Invoice' || log.messageType === 'Catalogue') {
          let pdfPath = '';
          if (log.invoice) {
            pdfPath = path.join(__dirname, '../uploads/invoices', `${log.invoice}.pdf`);
          } else {
            pdfPath = path.join(__dirname, '../uploads/temp/amudhasurabiy_brochure.pdf');
          }
          await whatsappService.sendPdf(log.mobile, log.messageText.split(' (PDF Attachment:')[0], pdfPath, log.customerId, log.messageType);
        } else {
          await whatsappService.sendMessage(log.mobile, log.messageText, log.customerId, log.messageType);
        }
        successCount++;
        log.status = 'Sent';
        await log.save();
      } catch (err) {
        failCount++;
        log.error = `Retry failed: ${err.message}`;
        await log.save();
      }
    }

    res.json({
      success: true,
      message: `Retried ${failedLogs.length} messages. Success: ${successCount}, Failed: ${failCount}`
    });
  } catch (err) {
    next(err);
  }
};

async function getActiveSettingsOrThrow() {
  const settings = await WhatsAppSettings.findOne();
  if (!settings || settings.status !== 'Connected') {
    throw new Error('CRM Not Connected');
  }
  if (!settings.crmApiKey) {
    throw new Error('API Key Missing');
  }
  return settings;
}

exports.getLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const type = req.query.type || '';

    const query = {};
    if (status) {
      query.status = status;
    }
    if (type) {
      query.messageType = type;
    }
    if (search) {
      query[Op.or] = [
        { mobile: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { messageText: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count: total, rows: logs } = await WhatsAppLog.findAndCountAll({
      where: query,
      order: [['date', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit
    });

    res.json({
      success: true,
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sentToday = await WhatsAppLog.count({
      where: {
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const delivered = await WhatsAppLog.count({
      where: {
        status: 'Delivered',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const read = await WhatsAppLog.count({
      where: {
        status: 'Read',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const failed = await WhatsAppLog.count({
      where: {
        status: 'Failed',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const pending = await WhatsAppLog.count({
      where: {
        status: 'Pending',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const activityList = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const count = await WhatsAppLog.count({
        where: {
          createdAt: {
            [Op.gte]: start,
            [Op.lt]: end
          }
        }
      });

      const dayName = start.toLocaleDateString('en-US', { weekday: 'short' });
      activityList.push({ day: dayName, count });
    }

    res.json({
      success: true,
      stats: {
        sentToday,
        delivered,
        read,
        failed,
        pending
      },
      activityChart: activityList
    });
  } catch (err) {
    next(err);
  }
};

exports.webhookReceiver = async (req, res, next) => {
  try {
    console.log('--- WhatsApp Webhook received ---', JSON.stringify(req.body));
    const { referenceId, status, error, messageId, ack, event, payload } = req.body;
    const msgId = referenceId || messageId || (payload && payload.id);
    const msgStatus = status || (payload && payload.status);

    if (msgId) {
      const log = await WhatsAppLog.findOne({
        where: {
          [Op.or]: [
            { response: { [Op.like]: `%${msgId}%` } },
            { id: msgId }
          ]
        }
      });

      if (log) {
        if (msgStatus) {
          log.status = msgStatus;
        } else if (ack === 2) {
          log.status = 'Delivered';
        } else if (ack === 3 || ack === 4) {
          log.status = 'Read';
        }
        if (error) {
          log.error = error;
        }
        await log.save();
        console.log(`Webhook updated WhatsApp log ID ${log.id} status to ${log.status}`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook execution failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
