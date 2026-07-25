const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const BatchRecall = sequelize.define('BatchRecall', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  returnCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  recallLevel: {
    type: DataTypes.ENUM(
      'Internal Hold',
      'Distributor Recall',
      'Retail Recall',
      'Customer Recall',
      'Regulatory Recall'
    ),
    defaultValue: 'Internal Hold',
  },
  isRecalled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  salesBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  websiteBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  invoiceBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  recalledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  actionPlan: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: true,
});

BatchRecall.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(BatchRecall, {
  product: 'productId',
});

module.exports = BatchRecall;
