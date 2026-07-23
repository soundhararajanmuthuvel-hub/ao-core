const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteReferral = sequelize.define(
  'WebsiteReferral',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referrerCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    referredCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    referralCodeUsed: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      defaultValue: 'Pending',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    generatedCouponCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteReferral);

module.exports = WebsiteReferral;
