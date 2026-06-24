const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebhookEndpoint = sequelize.define('WebhookEndpoint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING(1000),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  events: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  secret: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active',
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_webhook_endpoints',
  timestamps: true,
});

makeMongooseCompatible(WebhookEndpoint);

module.exports = WebhookEndpoint;
