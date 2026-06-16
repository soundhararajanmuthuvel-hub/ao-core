const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const RepackRecipe = require('./RepackRecipe');
const Product = require('./Product');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const RepackEntry = sequelize.define('RepackEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  repackNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  qtyToProduce: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  rawMaterialCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  packingMaterialCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  laborCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  otherCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  costPerUnit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'reversed'),
    allowNull: false,
    defaultValue: 'completed',
  },
  packSizeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lossQty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
});

// Associations
RepackEntry.belongsTo(RepackRecipe, { as: 'recipe', foreignKey: 'recipeId' });
RepackEntry.belongsTo(Product, { as: 'finishedProduct', foreignKey: 'finishedProductId' });
RepackEntry.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
const ProductPackSize = require('./ProductPackSize');
RepackEntry.belongsTo(ProductPackSize, { as: 'packSize', foreignKey: 'packSizeId' });

makeMongooseCompatible(RepackEntry, {
  recipe: 'recipeId',
  finishedProduct: 'finishedProductId',
  createdBy: 'createdById',
  packSize: 'packSizeId',
});

module.exports = RepackEntry;
