const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationExportCredential = sequelize.define('IntegrationExportCredential', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  apiSecret: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  webhookSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active',
  },
  environment: {
    type: DataTypes.STRING,
    defaultValue: 'Live',
  },
  permissions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowedIps: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rateLimitCount: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastUsed: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_export_credentials',
  timestamps: true,
});

makeMongooseCompatible(IntegrationExportCredential);

module.exports = IntegrationExportCredential;
