const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'AO Core' },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    gstDetails: { type: String, default: '' },
    invoicePrefix: { type: String, default: 'INV' },
    financialYear: { type: String, default: '2025-26' },
    brandColor: { type: String, default: '#2563eb' },
    defaultDarkMode: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 10 },
    invoiceCounter: { type: Number, default: 0 },
    purchaseCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
