const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteCart = sequelize.define(
  'WebsiteCart',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    websiteCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sessionKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    items: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]', // JSON array of cart items
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteCart);

module.exports = WebsiteCart;
