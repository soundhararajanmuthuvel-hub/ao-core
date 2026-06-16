const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerType: {
    type: DataTypes.ENUM(
      'White Label',
      'Organic Store',
      'Retail Shop',
      'D2C Customer',
      'Distributor',
      'Wholesaler',
      'Super Market',
      'Pharmacy',
      'Export Customer'
    ),
    defaultValue: 'Retail Shop',
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  creditLimit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentTerms: {
    type: DataTypes.STRING,
    defaultValue: 'COD',
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Archived'),
    defaultValue: 'Active',
  },
  // White Label Fields
  brandName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  labelDesignRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  packagingType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  moq: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  specialPricing: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  manufacturingNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Organic Store Fields
  storeCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // D2C Fields
  gstBillingMode: {
    type: DataTypes.ENUM('default', 'registered', 'inclusive', 'exclusive', 'no_gst'),
    defaultValue: 'default',
  },
  wooCustomerId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remindersSent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  paymentCycle: {
    type: DataTypes.STRING,
    defaultValue: 'Bill to Bill',
  },
  creditDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  averagePaymentDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  billToBillEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  invoiceOutstandingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

makeMongooseCompatible(Customer);

module.exports = Customer;
