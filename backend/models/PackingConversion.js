const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const PackingConversion = sequelize.define('PackingConversion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversionNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'completed',
  },
  sourceQty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

PackingConversion.belongsTo(Product, { as: 'sourceProduct', foreignKey: 'sourceProductId', onDelete: 'CASCADE' });
PackingConversion.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'CASCADE' });

makeMongooseCompatible(PackingConversion, {
  sourceProduct: 'sourceProductId',
  createdBy: 'createdById',
});

module.exports = PackingConversion;
