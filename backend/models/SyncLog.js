const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const SyncLog = sequelize.define('SyncLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  module: {
    type: DataTypes.STRING, // 'Products', 'Orders', 'Customers', 'Inventory'
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING, // 'Import', 'Export', 'Sync'
    allowNull: false,
  },
  success: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  failed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  duration: {
    type: DataTypes.INTEGER, // in milliseconds
    defaultValue: 0,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

makeMongooseCompatible(SyncLog);

module.exports = SyncLog;
