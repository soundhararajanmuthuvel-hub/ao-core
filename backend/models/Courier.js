const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Courier = sequelize.define('Courier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingUrlFormat: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

makeMongooseCompatible(Courier, {});

module.exports = Courier;
