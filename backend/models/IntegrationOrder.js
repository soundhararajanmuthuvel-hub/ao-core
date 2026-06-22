const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationOrder = sequelize.define('IntegrationOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  items: {
    type: DataTypes.TEXT, // Store JSON string of items: [{ name, sku, qty, price, total }]
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Pending',
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Unpaid',
  },
  shipmentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Unshipped',
  },
  orderDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_orders',
  timestamps: true,
});

makeMongooseCompatible(IntegrationOrder);

module.exports = IntegrationOrder;
