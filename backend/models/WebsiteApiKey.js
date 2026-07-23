const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteApiKey = sequelize.define(
  'WebsiteApiKey',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Blovit Storefront API Key',
    },
    apiKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    apiSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Revoked'),
      defaultValue: 'Active',
    },
    environment: {
      type: DataTypes.STRING,
      defaultValue: 'Production',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteApiKey);

module.exports = WebsiteApiKey;
