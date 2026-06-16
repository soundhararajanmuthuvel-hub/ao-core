const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Settings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  companyName: {
    type: DataTypes.STRING,
    defaultValue: 'AO Core',
  },
  logo: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  address: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  phone: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  email: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  gstDetails: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  gstNumber: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  invoicePrefix: {
    type: DataTypes.STRING,
    defaultValue: 'INV',
  },
  financialYear: {
    type: DataTypes.STRING,
    defaultValue: '2025-26',
  },
  brandColor: {
    type: DataTypes.STRING,
    defaultValue: '#2563eb',
  },
  defaultDarkMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  roleBasedLogin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lowStockThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  invoiceCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  purchaseCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shipmentCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  wooUrl: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooConsumerKey: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooConsumerSecret: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooApiKey: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooWebhookSecret: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooSyncInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  wooConnected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  wooSyncStockERPToWoo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  wooStoreDescription: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  wooVersion: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooWordpressVersion: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  wooApiStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Disconnected',
  },
  wooProductSyncMode: {
    type: DataTypes.ENUM('ERP Master', 'Website Master', 'Two-Way Sync'),
    defaultValue: 'Two-Way Sync',
  },
  wooOrderSyncMode: {
    type: DataTypes.ENUM('Manual', 'Automatic', 'Real-Time'),
    defaultValue: 'Real-Time',
  },
  wooInventorySyncMode: {
    type: DataTypes.ENUM('ERP Master', 'Website Master', 'Two-Way Sync'),
    defaultValue: 'Two-Way Sync',
  },
  wooCurrency: {
    type: DataTypes.STRING,
    defaultValue: 'INR',
  },
  wooLastSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  wooLastProductSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  wooLastOrderSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  wooLastCustomerSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  wooLastInventorySyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  shippingMode: {
    type: DataTypes.ENUM('free', 'fixed', 'weight', 'value', 'customer_type', 'zone', 'included'),
    defaultValue: 'free',
  },
  shippingFixedCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  shippingWeightRules: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
  },
  shippingValueThreshold: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 999,
  },
  shippingValueAboveCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  shippingValueBelowCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 80,
  },
  shippingCustomerTypeRates: {
    type: DataTypes.TEXT,
    defaultValue: '{}',
  },
  packingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  handlingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  courierCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  loadingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  mergeShippingCharges: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  defaultGstMode: {
    type: DataTypes.ENUM('exclusive', 'inclusive', 'no_gst'),
    defaultValue: 'exclusive',
  },
  invoiceTheme: {
    type: DataTypes.STRING,
    defaultValue: 'default',
  },
  invoiceFormat: {
    type: DataTypes.ENUM('Standard', 'Compact', 'Thermal'),
    defaultValue: 'Standard',
  },
  ignoredSuggestions: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
  },
  shippingZoneRates: {
    type: DataTypes.TEXT,
    defaultValue: '{"tamil_nadu":50,"south_india":80,"rest_of_india":120}',
  },
  boxWeight: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0.200,
  },
  packingMaterialWeight: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0.100,
  },
  logisticsCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 16.00,
  },
  orderCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  upiId: {
    type: DataTypes.STRING,
    defaultValue: '7010602115@iob',
  },
  payeeName: {
    type: DataTypes.STRING,
    defaultValue: 'AMUDHASURABIY ORGANICS',
  },
});

makeMongooseCompatible(Settings);

module.exports = Settings;
