const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  qty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  gstPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  lineTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  freeQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  schemeApplied: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dispatchedQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  pendingQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  offerCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  actualProfit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
});

InvoiceItem.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(InvoiceItem, { product: 'productId' });

module.exports = InvoiceItem;
