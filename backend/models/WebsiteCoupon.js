const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteCoupon = sequelize.define(
  'WebsiteCoupon',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM('percentage', 'flat'),
      defaultValue: 'flat',
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    minOrderValue: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    usageLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    websiteCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Tied to a specific customer if generated via referral reward
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteCoupon);

module.exports = WebsiteCoupon;
