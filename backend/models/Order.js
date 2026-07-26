const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  area: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  orderDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expectedDispatchDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Prepared', 'Packed', 'Dispatched', 'Delivered'),
    defaultValue: 'Prepared',
  },
  logisticsCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 16.00,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false, // Array of { productId, name, qty, unitPrice, gstPercent, lineTotal }
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  courierPartner: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dispatchDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveredBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING,
    defaultValue: 'ERP_Manual', // ERP_Manual, WhatsApp_Capture, AI_Reading, Voice_Entry, Mobile_App, CRM
  },
  aiMetadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  is_historical_data: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['customerId'] },
    { fields: ['status'] },
    { fields: ['orderDate'] }
  ]
});

Order.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Order.belongsTo(require('./Invoice'), { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
Order.belongsTo(require('./Shipment'), { as: 'shipment', foreignKey: 'shipmentId', onDelete: 'CASCADE' });

makeMongooseCompatible(Order, {
  customer: 'customerId',
  invoice: 'invoiceId',
  shipment: 'shipmentId',
});

module.exports = Order;
