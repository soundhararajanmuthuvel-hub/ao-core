const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationConnection = sequelize.define('IntegrationConnection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  platformType: {
    type: DataTypes.ENUM(
      'Shopify',
      'WooCommerce',
      'ERPNext',
      'Odoo',
      'Zoho',
      'HubSpot',
      'Salesforce',
      'Google Sheets',
      'Custom REST API',
      'Custom GraphQL API',
      'Other'
    ),
    defaultValue: 'Custom REST API',
  },
  baseUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  apiKey: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  apiSecret: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  bearerToken: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  oauthClientId: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  oauthClientSecret: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  webhookSecret: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  connectionStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Disconnected',
  },
  syncFrequency: {
    type: DataTypes.ENUM('Manual', 'Hourly', 'Daily', 'Weekly', 'Realtime'),
    defaultValue: 'Manual',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  lastSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'integration_connections',
  timestamps: true,
});

makeMongooseCompatible(IntegrationConnection);

module.exports = IntegrationConnection;
