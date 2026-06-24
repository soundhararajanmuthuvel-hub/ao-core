const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebhookLog = sequelize.define('WebhookLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  endpointId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  event: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  responseStatus: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  responseBody: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attempt: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
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
  tableName: 'integration_webhook_logs',
  timestamps: true,
});

makeMongooseCompatible(WebhookLog);

module.exports = WebhookLog;
