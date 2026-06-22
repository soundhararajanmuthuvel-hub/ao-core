const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationSyncJob = sequelize.define('IntegrationSyncJob', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING, // 'Product', 'Customer', 'Order', 'Catalogue'
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING, // 'Pending', 'Processing', 'Completed', 'Failed'
    defaultValue: 'Pending',
  },
  triggerType: {
    type: DataTypes.STRING, // 'Manual', 'Scheduled', 'Webhook'
    defaultValue: 'Manual',
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
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
  tableName: 'integration_sync_jobs',
  timestamps: true,
});

makeMongooseCompatible(IntegrationSyncJob);

module.exports = IntegrationSyncJob;
