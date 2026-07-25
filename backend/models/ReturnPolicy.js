const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const ReturnPolicy = sequelize.define('ReturnPolicy', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerType: {
    type: DataTypes.STRING, // Retail Shop, Wholesale, Supermarket, D2C, Private Label, Distributor
    allowNull: false,
  },
  maxDaysAllowed: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
  },
  allowExpired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  allowNearExpiry: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  allowDamagedPacking: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  allowMfgDefect: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  requireApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  timestamps: true,
});

makeMongooseCompatible(ReturnPolicy, {});

module.exports = ReturnPolicy;
