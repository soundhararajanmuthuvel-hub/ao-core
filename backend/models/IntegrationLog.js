const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationLog = sequelize.define('IntegrationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING, // 'Product', 'Customer', 'Order', 'Catalogue'
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING, // 'Import', 'Sync', 'Webhook'
    allowNull: false,
  },
  recordsImported: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  recordsFailed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING, // 'Success', 'Failed'
    defaultValue: 'Success',
  },
  duration: {
    type: DataTypes.INTEGER, // milliseconds
    defaultValue: 0,
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
  tableName: 'integration_logs',
  timestamps: true,
});

makeMongooseCompatible(IntegrationLog);

module.exports = IntegrationLog;
