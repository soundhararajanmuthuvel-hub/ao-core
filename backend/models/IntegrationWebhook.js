const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationWebhook = sequelize.define('IntegrationWebhook', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  event: {
    type: DataTypes.STRING, // e.g. 'product.created', 'order.paid'
    allowNull: false,
  },
  payload: {
    type: DataTypes.TEXT, // Stringified JSON payload
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING, // 'Pending', 'Processed', 'Failed'
    defaultValue: 'Pending',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_webhooks',
  timestamps: true,
});

makeMongooseCompatible(IntegrationWebhook);

module.exports = IntegrationWebhook;
