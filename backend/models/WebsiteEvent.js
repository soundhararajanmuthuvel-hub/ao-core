const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteEvent = sequelize.define(
  'WebsiteEvent',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false, // page_view, add_to_cart, checkout_started, order_completed
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sessionKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    eventData: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON string payload
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteEvent);

module.exports = WebsiteEvent;
