const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const ProductAuditLog = sequelize.define('ProductAuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false, // create, update, publish, unpublish
  },
  oldValues: {
    type: DataTypes.TEXT,
    allowNull: true, // JSON
  },
  newValues: {
    type: DataTypes.TEXT,
    allowNull: true, // JSON
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
});

makeMongooseCompatible(ProductAuditLog);

module.exports = ProductAuditLog;
