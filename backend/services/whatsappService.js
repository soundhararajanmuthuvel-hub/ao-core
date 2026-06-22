const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppLog = require('../models/WhatsAppLog');
const Customer = require('../models/Customer');

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

function formatJid(phone) {
  let cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned.endsWith('@c.us') ? cleaned : `${cleaned}@c.us`;
}

async function getActiveSettings() {
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
  return settings;
}

async function makeProviderRequest(endpoint, payload, settings) {
  const decryptedApiKey = decrypt(settings.apiKey);
  const decryptedInstanceId = decrypt(settings.instanceId);
  const headers = {
    'Content-Type': 'application/json'
  };
  if (decryptedApiKey) {
    headers['Authorization'] = `Bearer ${decryptedApiKey}`;
  }

  const url = `${settings.apiUrl}${endpoint}`;
  
  if (settings.provider === 'WAHA') {
    const wahaPayload = {
      session: decryptedInstanceId || 'default',
      ...payload
    };
    return axios.post(url, wahaPayload, { headers, timeout: 15000 });
  } else {
    // Return mock successful result for other providers
    console.log(`Mocking request for ${settings.provider} to ${url}`);
    return { data: { id: 'mock_msg_' + Date.now() } };
  }
}

async function sendMessage(phone, text, customerId = null, messageType = 'Greeting') {
  const settings = await getActiveSettings();
  const jid = formatJid(phone);
  
  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: phone,
    messageType,
    messageText: text,
    status: 'Pending'
  });

  try {
    let response;
    if (settings.status === 'Connected') {
      response = await makeProviderRequest('/api/sendText', {
        chatId: jid,
        text: text
      }, settings);
    } else {
      // Offline mode/Mock sending
      response = { data: { id: 'MOCK_TXT_' + Date.now() } };
    }
    
    log.status = 'Sent';
    await log.save();
    return { success: true, messageId: response.data?.id || 'sent', logId: log.id };
  } catch (err) {
    console.error('Failed to send WhatsApp text:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    await log.save();
    throw err;
  }
}

async function sendPdf(phone, text, pdfPath, customerId = null, messageType = 'Invoice') {
  const settings = await getActiveSettings();
  const jid = formatJid(phone);
  
  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: phone,
    messageType,
    messageText: `${text} (PDF Attachment: ${path.basename(pdfPath)})`,
    status: 'Pending'
  });

  try {
    let response;
    if (settings.status === 'Connected' && fs.existsSync(pdfPath)) {
      const fileBuffer = fs.readFileSync(pdfPath);
      const base64Data = fileBuffer.toString('base64');
      const filename = path.basename(pdfPath);
      
      const payload = {
        chatId: jid,
        caption: text,
        file: {
          mimetype: 'application/pdf',
          filename: filename,
          data: base64Data
        }
      };
      
      response = await makeProviderRequest('/api/sendFile', payload, settings);
    } else {
      // Mock sending or text fallback
      response = { data: { id: 'MOCK_PDF_' + Date.now() } };
    }

    log.status = 'Sent';
    await log.save();
    return { success: true, messageId: response.data?.id || 'sent', logId: log.id };
  } catch (err) {
    console.error('Failed to send WhatsApp PDF:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    await log.save();
    throw err;
  }
}

async function sendImage(phone, text, imagePath, customerId = null, messageType = 'Greeting') {
  const settings = await getActiveSettings();
  const jid = formatJid(phone);
  
  let customerName = null;
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) customerName = customer.name;
  }

  const log = await WhatsAppLog.create({
    customerId,
    customerName,
    mobile: phone,
    messageType,
    messageText: `${text} (Image Attachment: ${path.basename(imagePath)})`,
    status: 'Pending'
  });

  try {
    let response;
    if (settings.status === 'Connected' && fs.existsSync(imagePath)) {
      const fileBuffer = fs.readFileSync(imagePath);
      const base64Data = fileBuffer.toString('base64');
      const filename = path.basename(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      
      const payload = {
        chatId: jid,
        caption: text,
        file: {
          mimetype: mime,
          filename: filename,
          data: base64Data
        }
      };
      
      response = await makeProviderRequest('/api/sendFile', payload, settings);
    } else {
      response = { data: { id: 'MOCK_IMG_' + Date.now() } };
    }

    log.status = 'Sent';
    await log.save();
    return { success: true, messageId: response.data?.id || 'sent', logId: log.id };
  } catch (err) {
    console.error('Failed to send WhatsApp Image:', err.message);
    log.status = 'Failed';
    log.error = err.message;
    await log.save();
    throw err;
  }
}

async function runAutoPaymentReminders() {
  const Invoice = require('../models/Invoice');
  const { Op } = require('sequelize');
  
  const now = new Date();
  
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
          messageText: { [Op.like]: `%Invoice ${inv.invoiceNumber}%` },
          createdAt: { [Op.gte]: startOfDay }
        }
      });
      
      if (alreadySent) {
        console.log(`[WhatsApp Reminders] Auto reminder for Invoice ${inv.invoiceNumber} was already sent today.`);
        continue;
      }
      
      const pendingAmount = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      const text = `Dear ${inv.customer.name},

This is a reminder that Invoice ${inv.invoiceNumber} has a pending balance of ₹${pendingAmount.toFixed(2)}.

Kindly arrange payment.

Thank you,
Amudhasurabiy Organics`;

      try {
        await sendMessage(inv.customer.phone, text, inv.customerId, 'Payment Reminder');
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
  formatJid,
  getActiveSettings,
  sendMessage,
  sendPdf,
  sendImage,
  runAutoPaymentReminders
};
