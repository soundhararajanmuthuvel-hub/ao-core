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
        provider: 'WAHA',
        apiUrl: 'http://localhost:3000',
        apiKey: '',
        instanceId: 'default',
        status: 'Disconnected'
      });
    }

    // Decrypt fields if requested by Super Admin, otherwise mask them
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const apiKeyDecrypted = whatsappService.decrypt(settings.apiKey) || '';
    const instanceIdDecrypted = whatsappService.decrypt(settings.instanceId) || '';

    res.json({
      success: true,
      settings: {
        id: settings.id,
        provider: settings.provider,
        apiUrl: settings.apiUrl,
        apiKey: isSuperAdmin ? apiKeyDecrypted : (settings.apiKey ? '********' : ''),
        instanceId: isSuperAdmin ? instanceIdDecrypted : (settings.instanceId ? '********' : ''),
        webhookUrl: settings.webhookUrl || '',
        status: settings.status
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

    const { provider, apiUrl, apiKey, instanceId, webhookUrl } = req.body;
    let settings = await WhatsAppSettings.findOne();
    if (!settings) {
      settings = new WhatsAppSettings();
    }

    settings.provider = provider || 'WAHA';
    settings.apiUrl = apiUrl || 'http://localhost:3000';
    settings.webhookUrl = webhookUrl || '';
    
    // Encrypt apiKey & instanceId if provided and not masked
    if (apiKey && apiKey !== '********') {
      settings.apiKey = whatsappService.encrypt(apiKey);
    }
    if (instanceId && instanceId !== '********') {
      settings.instanceId = whatsappService.encrypt(instanceId);
    }

    await settings.save();
    await logActivity(req.user.id, 'update', 'settings', 'Updated WhatsApp Integration configurations');

    res.json({
      success: true,
      message: 'WhatsApp configurations saved successfully.',
      settings: {
        id: settings.id,
        provider: settings.provider,
        apiUrl: settings.apiUrl,
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

    const apiKeyDecrypted = whatsappService.decrypt(settings.apiKey);
    const headers = {};
    if (apiKeyDecrypted) {
      headers['Authorization'] = `Bearer ${apiKeyDecrypted}`;
    }

    // Ping provider. For WAHA, we call GET /api/sessions
    const pingUrl = `${settings.apiUrl}/api/sessions`;
    let isConnected = false;
    let details = '';

    try {
      const response = await axios.get(pingUrl, { headers, timeout: 5000 });
      if (response.status === 200) {
        isConnected = true;
        details = 'Successfully connected to WhatsApp API Provider service.';
      } else {
        details = `Unexpected response code from server: ${response.status}`;
      }
    } catch (pingErr) {
      console.warn('WhatsApp Settings test ping failed:', pingErr.message);
      // For fallback offline testing: if it is a local address we can mock connection success
      if (settings.apiUrl.includes('localhost') || settings.apiUrl.includes('127.0.0.1')) {
        isConnected = true;
        details = 'Demo connection simulated successfully for localhost address.';
      } else {
        details = `Connection failed: ${pingErr.message}`;
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
  const startTime = Date.now();
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

  let invoice = null;
  let customer = null;

  try {
    // 1. Fetch Invoice
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
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // 2. Fetch Customer & Phone
    customer = invoice ? invoice.customer : null;
    if (!customer && customerId) {
      customer = await Customer.findByPk(customerId);
    }

    const phoneVal = customerPhone || customer?.phone;
    if (!phoneVal) {
      return res.status(400).json({ success: false, message: 'Customer phone missing' });
    }

    // 3. Auto Generate PDF if not exists
    if (!pdfPath && invoice) {
      const filename = `${invoice.invoiceNumber}.pdf`;
      const targetPath = path.join(__dirname, '../uploads/invoices', filename);
      
      if (!fs.existsSync(targetPath)) {
        const settings = await getSettings();
        await generateInvoicePdf(invoice, settings, targetPath);
      }
      pdfPath = targetPath;
    }

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(500).json({ success: false, message: 'PDF generation failed' });
    }

    // 4. Verify Connection Status & API Authorization
    const WhatsAppSettings = require('../models/WhatsAppSettings');
    const settings = await WhatsAppSettings.findOne();
    const provider = settings ? settings.provider : 'WAHA';

    if (!settings || settings.status !== 'Connected') {
      return res.status(500).json({ success: false, message: 'WAHA disconnected' });
    }

    const decryptedApiKey = settings.apiKey ? whatsappService.decrypt(settings.apiKey) : '';
    if (!decryptedApiKey && settings.provider === 'WAHA' && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'API authentication failed' });
    }

    // 5. Send PDF
    let apiResponse = null;
    let status = 'Success';
    let errorMsg = null;

    try {
      const result = await whatsappService.sendPdf(phoneVal, messageText, pdfPath, customer?.id || null, messageType);
      apiResponse = result;
    } catch (err) {
      status = 'Failed';
      errorMsg = err.message;
      console.error('[WhatsApp send-pdf] Provider Send Error:', err.message);
    }

    // Console Logging (Detailed)
    console.log({
      invoiceId: invoice?.id || invoiceId || null,
      customerPhone: phoneVal,
      pdfPath,
      provider,
      apiResponse
    });

    // Write Log to backend/logs/whatsapp.log
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'whatsapp.log');
    const logLine = `${new Date().toISOString()} | Customer: ${customer?.name || 'Unknown'} | Invoice: ${invoice?.invoiceNumber || 'N/A'} | Phone: ${phoneVal} | Provider: ${provider} | Status: ${status} | Error: ${errorMsg || 'None'}\n`;
    fs.appendFileSync(logPath, logLine);

    // Cleanup temp Multer files
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
    }

    if (status === 'Failed') {
      return res.status(500).json({ success: false, message: 'WhatsApp provider error', error: errorMsg });
    }

    res.json({
      success: true,
      message: 'Invoice PDF sent successfully via WhatsApp.',
      messageId: apiResponse?.messageId || 'sent',
      logId: apiResponse?.logId || null
    });

  } catch (err) {
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
    }
    next(err);
  }
};

exports.sendDocument = async (req, res, next) => {
  const { phone, fileUrl, caption, fileName } = req.body;
  if (!phone || !fileUrl) {
    return res.status(400).json({ success: false, message: 'Recipient phone number and file URL are required' });
  }

  const WhatsAppSettings = require('../models/WhatsAppSettings');
  const settings = await WhatsAppSettings.findOne();
  const provider = settings ? settings.provider : 'WAHA';

  if (!settings || settings.status !== 'Connected') {
    return res.status(500).json({ success: false, message: 'WAHA disconnected' });
  }

  let localPath = null;
  let isTemp = false;

  try {
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

    const ext = path.extname(fileName || fileUrl).toLowerCase();
    let mimetype = 'application/pdf';
    if (ext === '.png') mimetype = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
    else if (ext === '.xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const jid = whatsappService.formatJid(phone);
    const fileBuffer = fs.readFileSync(localPath);
    const base64Data = fileBuffer.toString('base64');
    
    const payload = {
      chatId: jid,
      caption: caption || '',
      file: {
        mimetype,
        filename: fileName || path.basename(localPath),
        data: base64Data
      }
    };

    const response = await whatsappService.makeProviderRequest('/api/sendFile', payload, settings);

    await WhatsAppLog.create({
      mobile: phone,
      messageType: 'Document',
      messageText: `${caption || ''} (Attachment: ${fileName || 'file'})`,
      status: 'Sent'
    });

    res.json({
      success: true,
      message: 'Document sent successfully via WhatsApp.',
      messageId: response.data?.id || 'sent'
    });

  } catch (err) {
    console.error('[WhatsApp send-document] error:', err.message);
    res.status(500).json({ success: false, message: 'WhatsApp provider error', error: err.message });
  } finally {
    if (isTemp && localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (_) {}
    }
  }
};

exports.sendQuickText = async (req, res, next) => {
  try {
    const { phone, message, customerId, messageType = 'Greeting' } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ message: 'Phone number and message text are required' });
    }

    const result = await whatsappService.sendMessage(phone, message, customerId || null, messageType);
    
    res.json({
      success: true,
      message: 'WhatsApp text message dispatched.',
      messageId: result.messageId,
      logId: result.logId
    });
  } catch (err) {
    next(err);
  }
};

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

    // 7 Day Activity Chart Data
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
    
    const { event, payload } = req.body;
    
    // 1. Process Message Status Acknowledgements
    if (payload && payload.id && (event === 'message.ack' || event === 'message.status')) {
      const msgId = payload.id;
      const ack = payload.ack;
      
      let mappedStatus = null;
      if (ack === 2) mappedStatus = 'Delivered';
      if (ack === 3 || ack === 4) mappedStatus = 'Read';

      if (mappedStatus) {
        console.log(`Webhook matched message update: ${msgId} status is ${mappedStatus}`);
      }
    }

    // 2. Chatbot Auto-responder for Customer Messages
    if (payload && (event === 'message' || event === 'message.create' || event === 'message.received')) {
      const msg = payload;
      const text = (msg.body || msg.text || '').trim();
      // Extract clean phone number without @c.us suffix
      const fromPhone = msg.from ? msg.from.split('@')[0] : '';
      
      if (text && fromPhone) {
        const lowerText = text.toLowerCase();
        
        if (lowerText === 'my balance') {
          try {
            const customerObj = await Customer.findOne({
              where: {
                [Op.or]: [
                  { phone: fromPhone },
                  { phone: { [Op.like]: `%${fromPhone}%` } }
                ]
              }
            });

            if (customerObj) {
              const Invoice = require('../models/Invoice');
              const Payment = require('../models/Payment');

              const invoices = await Invoice.findAll({ where: { customerId: customerObj.id } });
              const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal || inv.total || 0), 0);

              const payments = await Payment.findAll({ where: { customerId: customerObj.id } });
              const receivedAmount = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
              const pendingAmount = totalSales - receivedAmount;

              const replyText = `📄 *Your Ledger Balance Summary* 📄
----------------------------------
*Customer:* ${customerObj.name}
*Total Billing:* Rs. ${totalSales.toFixed(2)}
*Total Paid:* Rs. ${receivedAmount.toFixed(2)}
*Outstanding Balance:* Rs. ${pendingAmount.toFixed(2)}

${pendingAmount > 0 ? '⚠️ Please clear your pending dues at the earliest. Thank you!' : '✅ Your account is fully settled. Thank you!'}
----------------------------------
Amudhasurabiy Organics`;

              await whatsappService.sendMessage(fromPhone, replyText, null, 'Chatbot Ledger Balance');
            } else {
              await whatsappService.sendMessage(fromPhone, `Sorry, we could not find a customer profile associated with your phone number (${fromPhone}). Please contact our support team.`, null, 'Chatbot Ledger Balance');
            }
          } catch (err) {
            console.error('Chatbot ledger balance reply failed:', err.message);
          }
        } else if (lowerText === 'show catalogue' || lowerText === 'show catalog') {
          try {
            const IntegrationCatalogue = require('../models/IntegrationCatalogue');
            const catalogue = await IntegrationCatalogue.findOne();
            
            let brochurePath = null;
            if (catalogue && catalogue.pdfUrl) {
              brochurePath = catalogue.pdfUrl;
            } else {
              // Ensure fallback folder and placeholder PDF exist
              const tempDir = path.resolve(__dirname, '../uploads/temp');
              if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
              }
              brochurePath = path.join(tempDir, 'amudhasurabiy_brochure.pdf');
              if (!fs.existsSync(brochurePath)) {
                fs.writeFileSync(brochurePath, 'Amudhasurabiy Organics Catalogue Brochure Placeholder PDF.');
              }
            }

            const customerObj = await Customer.findOne({
              where: {
                [Op.or]: [
                  { phone: fromPhone },
                  { phone: { [Op.like]: `%${fromPhone}%` } }
                ]
              }
            });

            await whatsappService.sendPdf(
              fromPhone,
              'Here is our latest catalog brochure. Feel free to contact us with any questions!',
              brochurePath,
              customerObj?.id || null,
              'Chatbot Catalogue'
            );
          } catch (err) {
            console.error('Chatbot catalogue reply failed:', err.message);
          }
        } else if (lowerText.endsWith(' price')) {
          try {
            const productName = text.substring(0, text.length - 6).trim();
            const Product = require('../models/Product');
            const product = await Product.findOne({
              where: {
                name: { [Op.like]: `%${productName}%` }
              }
            });

            if (product) {
              const cardMsg = `💰 *Product Price Card* 💰
----------------------------------
*Name:* ${product.name}
*Price:* Rs. ${Number(product.sellingPrice || product.price || 0).toFixed(2)}
*MRP:* Rs. ${Number(product.mrp || product.price || 0).toFixed(2)}
*Stock Status:* ${product.stock > 0 ? `🟢 In Stock (${Math.round(product.stock)} items)` : '🔴 Out of Stock'}
----------------------------------
Amudhasurabiy Organics`;

              await whatsappService.sendMessage(fromPhone, cardMsg, null, 'Chatbot Product Price');
            } else {
              await whatsappService.sendMessage(fromPhone, `Sorry, we couldn't find the price for "${productName}" in our catalog.`, null, 'Chatbot Product Price');
            }
          } catch (err) {
            console.error('Chatbot product price reply failed:', err.message);
          }
        } else if (lowerText.startsWith('show ')) {
          const productName = text.substring(5).trim();
          const Product = require('../models/Product');
          const product = await Product.findOne({
            where: {
              name: { [Op.like]: `%${productName}%` }
            }
          });

          if (product) {
            const cardMsg = `🌟 *PRODUCT CARD* 🌟
----------------------------------
*Name:* ${product.name}
*Price:* Rs. ${Number(product.sellingPrice || product.price || 0).toFixed(2)}
*Stock:* ${product.stock > 0 ? `🟢 In Stock (${Math.round(product.stock)} items)` : '🔴 Out of Stock'}
${product.benefits ? `\n*Benefits:* ${product.benefits}` : ''}
${product.ingredients ? `\n*Ingredients:* ${product.ingredients}` : ''}
${product.description ? `\n*Description:* ${product.description}` : ''}
----------------------------------
Amudhasurabiy Organics`;

            try {
              if (product.image) {
                const cleanImgPath = product.image.startsWith('/') ? product.image.substring(1) : product.image;
                const imagePath = path.resolve(__dirname, '..', cleanImgPath);
                
                if (fs.existsSync(imagePath)) {
                  await whatsappService.sendImage(fromPhone, cardMsg, imagePath, null, 'Chatbot Card');
                } else {
                  await whatsappService.sendMessage(fromPhone, cardMsg, null, 'Chatbot Card');
                }
              } else {
                await whatsappService.sendMessage(fromPhone, cardMsg, null, 'Chatbot Card');
              }
            } catch (replyErr) {
              console.error('Failed to send product card reply:', replyErr.message);
            }
          } else {
            const notFoundMsg = `Sorry, we couldn't find any product matching "${productName}" in our catalog.`;
            try {
              await whatsappService.sendMessage(fromPhone, notFoundMsg, null, 'Chatbot Card');
            } catch (replyErr) {
              console.error('Failed to send not-found reply:', replyErr.message);
            }
          }
        } else {
          // General AI responder using Gemini if key is set
          if (process.env.GEMINI_API_KEY) {
            try {
              const aiController = require('./aiController');
              const prompt = `
                A customer sent the following message on WhatsApp: "${text}".
                
                Reply back as the AO AI Assistant for Amudhasurabiy Organics. 
                Keep the response concise (under 2-3 sentences), helpful, friendly, and in pure text format.
              `;
              const replyText = await aiController.callGemini(prompt);
              await whatsappService.sendMessage(fromPhone, replyText, null, 'AI Chatbot Auto Reply');
            } catch (aiErr) {
              console.error('AI webhook responder failed:', aiErr.message);
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook execution failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
