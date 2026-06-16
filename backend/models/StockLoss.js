const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const RawMaterial = require('./RawMaterial');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const StockLoss = sequelize.define('StockLoss', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  itemType: {
    type: DataTypes.ENUM('finished_goods', 'raw_material', 'packaging_material'),
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rawMaterialId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  reason: {
    type: DataTypes.ENUM('Production Loss', 'Packing Damage', 'Expired', 'Returned Goods', 'Manual Adjustment'),
    allowNull: false,
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalLossValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

StockLoss.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'SET NULL' });
StockLoss.belongsTo(RawMaterial, { as: 'rawMaterial', foreignKey: 'rawMaterialId', onDelete: 'SET NULL' });
StockLoss.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(StockLoss, {
  product: 'productId',
  rawMaterial: 'rawMaterialId',
  createdBy: 'createdById',
});

module.exports = StockLoss;
