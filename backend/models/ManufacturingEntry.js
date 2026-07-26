const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ManufacturingRecipe = require('./ManufacturingRecipe');
const Product = require('./Product');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const ManufacturingEntry = sequelize.define('ManufacturingEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  mfgNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  qtyToProduce: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  rawMaterialCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  laborCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  otherCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  costPerUnit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('completed', 'pending', 'reversed'),
    defaultValue: 'completed',
  },
  productionMode: {
    type: DataTypes.ENUM('weight', 'pack'),
    defaultValue: 'weight',
  },
  packSizeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packagingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  overheadCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  remainingBulkStock: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
});

ManufacturingEntry.belongsTo(ManufacturingRecipe, { as: 'recipe', foreignKey: 'recipeId', onDelete: 'RESTRICT' });
ManufacturingEntry.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'RESTRICT' });
ManufacturingEntry.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'RESTRICT' });
const ProductPackSize = require('./ProductPackSize');
ManufacturingEntry.belongsTo(ProductPackSize, { as: 'packSize', foreignKey: 'packSizeId', onDelete: 'RESTRICT' });

makeMongooseCompatible(ManufacturingEntry, {
  recipe: 'recipeId',
  product: 'productId',
  createdBy: 'createdById',
  packSize: 'packSizeId',
});

module.exports = ManufacturingEntry;
