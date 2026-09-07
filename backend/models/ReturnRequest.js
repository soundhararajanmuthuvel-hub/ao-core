const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Customer = require('./Customer');
const User = require('./User');
const Invoice = require('./Invoice');
const { makeMongooseCompatible } = require('./compat');

const ReturnRequest = sequelize.define('ReturnRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  rmaNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  category: {
    type: DataTypes.ENUM('External', 'Internal'),
    defaultValue: 'External',
  },
  source: {
    type: DataTypes.STRING, // D2C, Retail Shop, Supermarket, Wholesale, Private Label, Distributor, Production, Packing, Warehouse, Quality Control
    defaultValue: 'Retail Shop',
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  warehouseId: {
    type: DataTypes.STRING,
    defaultValue: 'Main Warehouse',
  },
  warehouseZone: {
    type: DataTypes.ENUM('Receiving', 'QC', 'Repacking', 'Saleable', 'Near Expiry', 'Destroyed', 'Scrap'),
    defaultValue: 'Receiving',
  },
  returnType: {
    type: DataTypes.STRING,
    defaultValue: 'Customer Return',
  },
  returnReason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rootCause: {
    type: DataTypes.ENUM(
      'Manufacturing',
      'Packing',
      'Storage',
      'Transport',
      'Courier',
      'Retail Handling',
      'Customer Mishandling',
      'Unknown'
    ),
    defaultValue: 'Unknown',
  },
  status: {
    type: DataTypes.ENUM(
      'Requested',
      'Pending Approval',
      'Approved',
      'Pickup Scheduled',
      'Received',
      'QC Pending',
      'QC Passed',
      'QC Failed',
      'Repacking',
      'Transferred',
      'Replacement Sent',
      'Refund Completed',
      'Credit Note Generated',
      'Rejected',
      'Closed'
    ),
    defaultValue: 'Requested',
  },
  kanbanColumn: {
    type: DataTypes.STRING,
    defaultValue: 'Requested',
  },
  approvalLevel: {
    type: DataTypes.STRING, // Sales Manager, Admin, Super Admin
    defaultValue: 'Sales Manager',
  },
  approvedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  courierName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gpsLatitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  gpsLongitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  customerSignatureUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  qcRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  qcInspectorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  fraudRiskScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fraudFlags: {
    type: DataTypes.TEXT, // JSON string of flags
    allowNull: true,
  },
  totalQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  recoveredQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  destroyedQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  mfgCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  repackingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  transportCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  labourCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  replacementCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  scrapCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  recoveredValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  netLossValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  netRecoveryValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  netROI: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  recoveryPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  actionTaken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  productCondition: {
    type: DataTypes.STRING, // 'Good', 'Damaged', 'Expired', 'Not Resalable'
    defaultValue: 'Good',
  },
  refundAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  refundMethod: {
    type: DataTypes.STRING, // 'Original Payment Method', 'Cash', 'Bank Transfer', 'UPI', 'Credit / Customer Balance'
    defaultValue: 'Original Payment Method',
  },
  refundStatus: {
    type: DataTypes.STRING, // 'Pending', 'Refunded'
    defaultValue: 'Pending',
  },
  replacementProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  replacementQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  stockUpdated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  receivedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['rmaNumber'] },
    { fields: ['status'] },
    { fields: ['customerId'] },
    { fields: ['invoiceId'] },
    { fields: ['category'] }
  ]
});

ReturnRequest.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
ReturnRequest.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
ReturnRequest.belongsTo(User, { as: 'salesman', foreignKey: 'salesmanId', onDelete: 'SET NULL' });
ReturnRequest.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById', onDelete: 'SET NULL' });
ReturnRequest.belongsTo(User, { as: 'qcInspector', foreignKey: 'qcInspectorId', onDelete: 'SET NULL' });

makeMongooseCompatible(ReturnRequest, {
  customer: 'customerId',
  invoice: 'invoiceId',
  salesman: 'salesmanId',
  approvedBy: 'approvedById',
  qcInspector: 'qcInspectorId',
});

module.exports = ReturnRequest;
