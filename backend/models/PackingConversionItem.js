const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const PackingConversion = require('./PackingConversion');
const { makeMongooseCompatible } = require('./compat');

const PackingConversionItem = sequelize.define('PackingConversionItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  qty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  conversionFactor: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
  },
  totalWeight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

PackingConversionItem.belongsTo(Product, { as: 'targetProduct', foreignKey: 'targetProductId', onDelete: 'CASCADE' });
PackingConversionItem.belongsTo(PackingConversion, { as: 'packingConversion', foreignKey: 'packingConversionId', onDelete: 'CASCADE' });
PackingConversion.hasMany(PackingConversionItem, { as: 'items', foreignKey: 'packingConversionId', onDelete: 'CASCADE' });

makeMongooseCompatible(PackingConversionItem, {
  targetProduct: 'targetProductId',
  packingConversion: 'packingConversionId',
});

module.exports = PackingConversionItem;
