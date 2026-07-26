const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const PurchaseItem = require('./PurchaseItem');
const { makeMongooseCompatible } = require('./compat');

const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  purchaseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  supplier: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  supplierGstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  supplierGstType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  supplierState: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  supplierStateCode: {
    type: DataTypes.STRING(2),
    allowNull: true,
    defaultValue: '',
  },
  supplierPanNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  invoiceDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  invoicePdfPath: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  invoicePdfName: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  invoicePdfMimeType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  supplierTdsApplicable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  companyStateCode: {
    type: DataTypes.STRING(2),
    allowNull: true,
    defaultValue: '',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  taxableValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  taxTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  cgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  igstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  taxType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentStatus: {
    type: DataTypes.ENUM('Paid', 'Pending'),
    defaultValue: 'Pending',
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// Associations
Purchase.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'CASCADE' });
Purchase.belongsTo(require('./Supplier'), { as: 'supplierRelation', foreignKey: 'supplierId', onDelete: 'CASCADE' });

// A purchase has many items, which will be cascaded on deletion
Purchase.hasMany(PurchaseItem, { as: 'items', foreignKey: 'purchaseId', onDelete: 'CASCADE' });
PurchaseItem.belongsTo(Purchase, { as: 'purchase', foreignKey: 'purchaseId', onDelete: 'CASCADE' });

makeMongooseCompatible(Purchase, {
  createdBy: 'createdById',
});

module.exports = Purchase;
