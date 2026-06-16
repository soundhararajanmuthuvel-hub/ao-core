const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

const getSettings = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  let settings = await Settings.findOne(queryOpts);
  if (!settings) {
    settings = await Settings.create({}, queryOpts);
  }
  return settings;
};

const logActivity = async (userId, action, module, details, metadata = {}) => {
  try {
    // Map 'user' to 'userId' foreign key in Sequelize
    await ActivityLog.create({ userId, action, module, details, metadata });
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
};

const createNotification = async ({ title, message, type = 'info', link, user }, opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  try {
    // Map 'user' to 'userId' foreign key in Sequelize (can be null for global)
    await Notification.create({ title, message, type, link, userId: user || null }, queryOpts);
  } catch (e) {
    console.error('Notification error:', e.message);
  }
};

const calcLineTotal = (qty, unitPrice, gstPercent = 0) => {
  const base = qty * unitPrice;
  const gst = (base * gstPercent) / 100;
  return { base, gst, total: base + gst };
};

const calcInvoiceTotals = (items, discount = 0, gstMode = 'exclusive', charges = {}) => {
  let subtotal = 0;
  let gstTotal = 0;

  const parsedCharges = {
    shippingCharge: Number(charges.shippingCharge || 0),
    packingCharge: Number(charges.packingCharge || 0),
    handlingCharge: Number(charges.handlingCharge || 0),
    courierCharge: Number(charges.courierCharge || 0),
    otherCharge: Number(charges.otherCharge || 0),
  };

  const totalCharges = Object.values(parsedCharges).reduce((sum, val) => sum + val, 0);

  items.forEach((item) => {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const gstPercent = Number(item.gstPercent || 0);

    if (gstMode === 'inclusive') {
      const lineTotal = qty * unitPrice;
      const base = lineTotal / (1 + gstPercent / 100);
      const gst = lineTotal - base;
      subtotal += base;
      gstTotal += gst;
    } else if (gstMode === 'no_gst') {
      const base = qty * unitPrice;
      subtotal += base;
      gstTotal += 0;
    } else { // default 'exclusive'
      const base = qty * unitPrice;
      const gst = (base * gstPercent) / 100;
      subtotal += base;
      gstTotal += gst;
    }
  });

  const grandTotalBeforeRound = subtotal + gstTotal + totalCharges - Number(discount);
  const grandTotal = Math.max(0, Math.round(grandTotalBeforeRound));
  const roundOff = Number((grandTotal - grandTotalBeforeRound).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    gstTotal: Number(gstTotal.toFixed(2)),
    grandTotal,
    roundOff,
    ...parsedCharges,
  };
};

const getNextInvoiceNumber = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  const settings = await getSettings(queryOpts);
  settings.invoiceCounter += 1;
  await settings.save(queryOpts);
  const num = String(settings.invoiceCounter).padStart(5, '0');
  return `${settings.invoicePrefix}-${settings.financialYear}-${num}`;
};

const getNextPurchaseNumber = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  const settings = await getSettings(queryOpts);
  settings.purchaseCounter += 1;
  await settings.save(queryOpts);
  const num = String(settings.purchaseCounter).padStart(5, '0');
  return `PO-${settings.financialYear}-${num}`;
};

const getNextShipmentNumber = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  const settings = await getSettings(queryOpts);
  settings.shipmentCounter = (settings.shipmentCounter || 0) + 1;
  await settings.save(queryOpts);
  const num = String(settings.shipmentCounter).padStart(5, '0');
  return `SHP-${settings.financialYear}-${num}`;
};

const getNextOrderNumber = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  const settings = await getSettings(queryOpts);
  settings.orderCounter = (settings.orderCounter || 0) + 1;
  await settings.save(queryOpts);
  const num = String(settings.orderCounter).padStart(5, '0');
  return `ORD-${settings.financialYear}-${num}`;
};

const getNextPaymentNumber = async (opts = {}) => {
  const queryOpts = opts && opts.commit ? { transaction: opts.commit } : opts;
  const settings = await getSettings(queryOpts);
  settings.paymentCounter = (settings.paymentCounter || 0) + 1;
  await settings.save(queryOpts);
  const num = String(settings.paymentCounter).padStart(5, '0');
  return `PAY-${settings.financialYear}-${num}`;
};

module.exports = {
  getSettings,
  logActivity,
  createNotification,
  calcLineTotal,
  calcInvoiceTotals,
  getNextInvoiceNumber,
  getNextPurchaseNumber,
  getNextShipmentNumber,
  getNextOrderNumber,
  getNextPaymentNumber,
};
