const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const ProductPackSize = sequelize.define('ProductPackSize', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  packName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  weightInGrams: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  mrp: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  packagingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  stock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'g',
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active',
  },
  pouchId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  labelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  stickerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  cartonId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  bomJson: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '[]',
  },
});

// Associations
ProductPackSize.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'CASCADE' });
Product.hasMany(ProductPackSize, { as: 'packSizes', foreignKey: 'productId', onDelete: 'CASCADE' });

makeMongooseCompatible(ProductPackSize, {
  product: 'productId',
});

module.exports = ProductPackSize;
