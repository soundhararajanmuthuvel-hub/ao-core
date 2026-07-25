const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const ReturnAiInsight = sequelize.define('ReturnAiInsight', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  insightType: {
    type: DataTypes.STRING, // HIGH_RISK_PRODUCT, BATCH_FAILURE_PREDICTION, NEAR_EXPIRY_RISK, PACKAGING_TREND, SUPPLIER_DEFECT, SEASONAL_PATTERN
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Medium',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  dataPayload: {
    type: DataTypes.TEXT, // JSON string
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Dismissed', 'Resolved'),
    defaultValue: 'Active',
  }
}, {
  timestamps: true,
});

makeMongooseCompatible(ReturnAiInsight, {});

module.exports = ReturnAiInsight;
