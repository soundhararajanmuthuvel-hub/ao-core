const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const ApiAuditLog = sequelize.define('ApiAuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  apiKeyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  keyName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  environment: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  device: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  requestPayload: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responsePayload: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'api_audit_logs',
  timestamps: true,
});

makeMongooseCompatible(ApiAuditLog);

module.exports = ApiAuditLog;
