const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationProduct = sequelize.define('IntegrationProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  mrp: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  wholesalePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  distributorPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  gst: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
  },
  hsn: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  weight: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0.000,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  benefits: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  catalogueUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_products',
  timestamps: true,
});

makeMongooseCompatible(IntegrationProduct);

module.exports = IntegrationProduct;
