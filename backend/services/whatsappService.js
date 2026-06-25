const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppLog = require('../models/WhatsAppLog');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const IntegrationCatalogue = require('../models/IntegrationCatalogue');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'amudhasurabiyorganicssecretkey99'; // 32 characters
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) return text; // Not encrypted
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error('Decryption failed, returning raw text:', err.message);
    return text;
  }
}

// Phone formatting: removes spaces, asterisks (*), hyphens (-), and brackets.
// If length is 10, prefixes with '91'.
function formatPhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Backward compatible helper
function formatJid(phone) {
  return formatPhone(phone);
}

// Converts local file path in uploads to a public URL
function getPublicUrl(localPath) {
  if (!localPath) return '';
  const cleanPath = localPath.replace(/\\/g, '/');
  const parts = cleanPath.split('/uploads/');
  if (parts.length < 2) return '';
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${baseUrl.replace(/\/$/, '')}/uploads/${parts[1]}`;
}

async function getActiveSettings() {
  let settings = await WhatsAppSettings.findOne();
  if (!settings) {
    settings = await WhatsAppSettings.create({
      crmBaseUrl: 'http://localhost:5000/api/whatsapp/mock-crm',
      status: 'Disconnected'
    });
  }
  return settings;
}

// Central API sender that requests the Custom CRM API
async function sendRequestToCrmApi(settings, phone, type, message, mediaUrl = null, extraPayload = {}, invoiceNumber = null, catalogueName = null, customerId = null) {
  const cleanPhone = formatPhone(phone);
  if (!cleanPhone) {
    throw new Error('Customer Phone Missing');
  }

  if (!settings || settings.status !== 'Connected') {
    throw new Error('CRM Not Connected');
  }

  const crmApiKey = decrypt(settings.crmApiKey);
  if (!crmApiKey) {
    throw new Error('API Key Missing');
  }

  const crmSecret = decrypt(settings.crmSecret) || '';

  const crmBaseUrl = settings.crmBaseUrl || 'http://localhost:5000/api/whatsapp/mock-crm';

  // Construct CRM Payload
  const payload = {
    apiKey: crmApiKey,
    secret: crmSecret,
    phone: cleanPhone,
    type,
    message: message || '',
    mediaUrl: mediaUrl || '',
    payload: extraPayload || {}
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-CRM-API-KEY': crmApiKey,
    'X-CRM-SECRET': crmSecret
  };

  let response;
  try {
    response = await axios.post(crmBaseUrl, payload, { headers, timeout: 15000 });
  } catch (err) {
    console.error(`CRM API network / protocol error on ${crmBaseUrl}:`, err.message);
    if (err.code === 'ECONNREFUSED' || err.message.includes('timeout') || err.message.includes('Network Error')) {
      throw new Error('Network Error');
    } else if (err.response) {
      throw new Error('CRM API Rejected Request');
    } else {
      throw err;
    }
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error('CRM API Rejected Request');
  }

  return response.data;
}

async function sendMessage(phone, text, customerId = null, messageType = 'Greeting', invoiceId = null) {
  const settings = await getActiveSettings();
  const cleanPhone = formatPhone(phone);

  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  let invoiceNumber = null;
  let extraPayload = {};
  if (invoiceId) {
    const invoiceObj = await Invoice.findByPk(invoiceId);
    if (invoiceObj) {
      invoiceNumber = invoiceObj.invoiceNumber;
      extraPayload.invoiceNumber = invoiceNumber;
      extraPayload.dueDate = invoiceObj.dueDate;
    }
  }

  // Formatting for payment reminders if messageType is Payment Reminder
  if (messageType === 'Payment Reminder' && invoiceId) {
    const invoiceObj = await Invoice.findByPk(invoiceId, { include: [{ model: Customer, as: 'customer' }] });
    if (invoiceObj) {
      const balance = Number(invoiceObj.grandTotal || 0) - Number(invoiceObj.amountPaid || 0);
      const companyName = settings.companyName || 'Amudhasurabiy Organics';
      extraPayload = {
        customerName: invoiceObj.customer?.name || customerName || 'Customer',
        outstandingAmount: balance,
        invoiceNumbers: [invoiceObj.invoiceNumber],
        dueDate: invoiceObj.dueDate,
        paymentLink: `https://erp.amudhasurabiy.com/pay/${invoiceObj.id}`,
        companyDetails: `${companyName}, Phone: ${settings.phone || ''}`
      };
    }
  }

  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: cleanPhone || phone,
    messageType,
    messageText: text,
    invoice: invoiceNumber,
    status: 'Pending'
  });

  try {
    let crmType = 'text';
    if (messageType === 'Payment Reminder') crmType = 'payment_reminder';
    else if (messageType === 'Thank You Message' || messageType === 'Thank You') crmType = 'thank_you';

    const result = await sendRequestToCrmApi(
      settings,
      phone,
      crmType,
      text,
      null,
      extraPayload,
      invoiceNumber,
      null,
      customerId
    );

    log.status = 'Sent';
    log.response = JSON.stringify(result);
    await log.save();

    return { 
      success: true, 
      messageId: result.referenceId || result.messageId || 'sent', 
      logId: log.id,
      data: {
        customerName: customerName || 'Valued Customer',
        phone: cleanPhone,
        messageType,
        timestamp: log.createdAt,
        referenceId: result.referenceId || result.messageId || 'sent'
      }
    };
  } catch (err) {
    console.error('Failed to send WhatsApp text:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    log.response = err.response ? JSON.stringify(err.response.data) : null;
    await log.save();
    throw err;
  }
}

async function sendPdf(phone, text, pdfPath, customerId = null, messageType = 'Invoice', invoiceId = null) {
  const settings = await getActiveSettings();
  const cleanPhone = formatPhone(phone);

  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  let invoiceNumber = null;
  if (invoiceId) {
    const invoiceObj = await Invoice.findByPk(invoiceId);
    if (invoiceObj) invoiceNumber = invoiceObj.invoiceNumber;
  }

  const filename = pdfPath ? path.basename(pdfPath) : 'document.pdf';
  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: cleanPhone || phone,
    messageType,
    messageText: `${text} (PDF Attachment: ${filename})`,
    invoice: invoiceNumber,
    status: 'Pending'
  });

  try {
    const pdfUrl = getPublicUrl(pdfPath);
    let crmType = 'invoice_pdf';
    if (messageType === 'Catalogue' || messageType === 'Chatbot Catalogue') {
      crmType = 'catalogue_pdf';
    }

    const result = await sendRequestToCrmApi(
      settings,
      phone,
      crmType,
      text,
      pdfUrl,
      { filename },
      invoiceNumber,
      crmType === 'catalogue_pdf' ? filename : null,
      customerId
    );

    log.status = 'Sent';
    log.response = JSON.stringify(result);
    await log.save();

    return { 
      success: true, 
      messageId: result.referenceId || result.messageId || 'sent', 
      logId: log.id,
      data: {
        customerName: customerName || 'Valued Customer',
        phone: cleanPhone,
        messageType,
        timestamp: log.createdAt,
        referenceId: result.referenceId || result.messageId || 'sent'
      }
    };
  } catch (err) {
    console.error('Failed to send WhatsApp PDF:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    log.response = err.response ? JSON.stringify(err.response.data) : null;
    await log.save();
    throw err;
  }
}

async function sendImage(phone, text, imagePath, customerId = null, messageType = 'Greeting', invoiceId = null) {
  const settings = await getActiveSettings();
  const cleanPhone = formatPhone(phone);

  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  let invoiceNumber = null;
  if (invoiceId) {
    const invoiceObj = await Invoice.findByPk(invoiceId);
    if (invoiceObj) invoiceNumber = invoiceObj.invoiceNumber;
  }

  const filename = imagePath ? path.basename(imagePath) : 'image.jpg';
  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: cleanPhone || phone,
    messageType,
    messageText: `${text} (Image Attachment: ${filename})`,
    invoice: invoiceNumber,
    status: 'Pending'
  });

  try {
    const imageUrl = getPublicUrl(imagePath);
    let crmType = 'product_image';
    if (messageType === 'Catalogue' || messageType === 'Chatbot Catalogue') {
      crmType = 'catalogue_image';
    } else if (messageType === 'Product Card' || messageType === 'Chatbot Card') {
      crmType = 'product_card';
    }

    const result = await sendRequestToCrmApi(
      settings,
      phone,
      crmType,
      text,
      imageUrl,
      { filename },
      invoiceNumber,
      crmType === 'catalogue_image' ? filename : null,
      customerId
    );

    log.status = 'Sent';
    log.response = JSON.stringify(result);
    await log.save();

    return { 
      success: true, 
      messageId: result.referenceId || result.messageId || 'sent', 
      logId: log.id,
      data: {
        customerName: customerName || 'Valued Customer',
        phone: cleanPhone,
        messageType,
        timestamp: log.createdAt,
        referenceId: result.referenceId || result.messageId || 'sent'
      }
    };
  } catch (err) {
    console.error('Failed to send WhatsApp Image:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    log.response = err.response ? JSON.stringify(err.response.data) : null;
    await log.save();
    throw err;
  }
}

async function runAutoPaymentReminders() {
  const Invoice = require('../models/Invoice');
  const { Op } = require('sequelize');

  const invoices = await Invoice.findAll({
    where: {
      paymentStatus: { [Op.notIn]: ['paid', 'PAID'] },
      status: { [Op.notIn]: ['Cancelled', 'Draft'] },
      dueDate: { [Op.ne]: null }
    },
    include: [{ model: Customer, as: 'customer' }]
  });

  let countSent = 0;
  for (const inv of invoices) {
    if (!inv.customer || !inv.customer.phone) continue;

    const dueDate = new Date(inv.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const diffTime = currentDate - dueDate;
    const daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if ([3, 7, 15, 30].includes(daysPastDue)) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const alreadySent = await WhatsAppLog.findOne({
        where: {
          customerId: inv.customerId,
          messageType: 'Payment Reminder',
          invoice: inv.invoiceNumber,
          createdAt: { [Op.gte]: startOfDay }
        }
      });

      if (alreadySent) {
        console.log(`[WhatsApp Reminders] Auto reminder for Invoice ${inv.invoiceNumber} was already sent today.`);
        continue;
      }

      const pendingAmount = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      const text = `Dear ${inv.customer.name},\n\nThis is a reminder that Invoice ${inv.invoiceNumber} has a pending balance of ₹${pendingAmount.toFixed(2)}.\n\nKindly arrange payment.\n\nThank you,\nAmudhasurabiy Organics`;

      try {
        await sendMessage(inv.customer.phone, text, inv.customerId, 'Payment Reminder', inv.id);
        countSent++;
        console.log(`[WhatsApp Reminders] Sent auto reminder for Invoice ${inv.invoiceNumber} to ${inv.customer.name}`);
      } catch (err) {
        console.error(`[WhatsApp Reminders] Failed to send auto reminder for Invoice ${inv.invoiceNumber}:`, err.message);
      }
    }
  }

  return countSent;
}

module.exports = {
  encrypt,
  decrypt,
  formatPhone,
  formatJid,
  getActiveSettings,
  sendMessage,
  sendPdf,
  sendImage,
  runAutoPaymentReminders,
  getPublicUrl
};
