const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteShippingRule = sequelize.define(
  'WebsiteShippingRule',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true, // e.g., "Tamil Nadu", "ALL"
    },
    pincodePrefix: {
      type: DataTypes.STRING,
      allowNull: true, // e.g. "600", "638", or null/empty for all
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 50.0,
    },
    freeShippingThreshold: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 999.0, // Order subtotal above this gets free shipping
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

makeMongooseCompatible(WebsiteShippingRule);

module.exports = WebsiteShippingRule;
