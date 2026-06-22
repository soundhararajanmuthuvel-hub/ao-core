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
  apiKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  apiSecret: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active',
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
