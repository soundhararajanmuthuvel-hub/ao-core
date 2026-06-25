const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WhatsAppLog = sequelize.define('WhatsAppLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  messageType: {
    type: DataTypes.STRING,
    defaultValue: 'Greeting',
  },
  messageText: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Sent', 'Delivered', 'Read', 'Failed', 'Pending'),
    defaultValue: 'Pending',
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  invoice: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  catalogue: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
});

const Customer = require('./Customer');
WhatsAppLog.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'SET NULL' });
Customer.hasMany(WhatsAppLog, { as: 'whatsappLogs', foreignKey: 'customerId', onDelete: 'SET NULL' });

makeMongooseCompatible(WhatsAppLog, {
  customer: 'customerId'
});

module.exports = WhatsAppLog;
