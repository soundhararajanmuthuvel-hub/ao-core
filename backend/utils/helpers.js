const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
};

const logActivity = async (userId, action, module, details, metadata = {}) => {
  try {
    await ActivityLog.create({ user: userId, action, module, details, metadata });
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
};

const createNotification = async ({ title, message, type = 'info', link, user }) => {
  try {
    await Notification.create({ title, message, type, link, user });
  } catch (e) {
    console.error('Notification error:', e.message);
  }
};

const calcLineTotal = (qty, unitPrice, gstPercent = 0) => {
  const base = qty * unitPrice;
  const gst = (base * gstPercent) / 100;
  return { base, gst, total: base + gst };
};

const calcInvoiceTotals = (items, discount = 0) => {
  let subtotal = 0;
  let gstTotal = 0;
  items.forEach((item) => {
    const base = item.qty * item.unitPrice;
    const gst = (base * (item.gstPercent || 0)) / 100;
    subtotal += base;
    gstTotal += gst;
  });
  const grandTotal = subtotal + gstTotal - discount;
  return { subtotal, gstTotal, grandTotal: Math.max(0, grandTotal) };
};

const getNextInvoiceNumber = async () => {
  const settings = await getSettings();
  settings.invoiceCounter += 1;
  await settings.save();
  const num = String(settings.invoiceCounter).padStart(5, '0');
  return `${settings.invoicePrefix}-${settings.financialYear}-${num}`;
};

const getNextPurchaseNumber = async () => {
  const settings = await getSettings();
  settings.purchaseCounter += 1;
  await settings.save();
  const num = String(settings.purchaseCounter).padStart(5, '0');
  return `PO-${settings.financialYear}-${num}`;
};

module.exports = {
  getSettings,
  logActivity,
  createNotification,
  calcLineTotal,
  calcInvoiceTotals,
  getNextInvoiceNumber,
  getNextPurchaseNumber,
};
