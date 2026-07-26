const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const ManufacturingRecipe = sequelize.define('ManufacturingRecipe', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  yieldQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1.00,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
  },
  variantProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packSize: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  yieldPacks: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  packWeight: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
  wastagePercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
  },
});

ManufacturingRecipe.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'CASCADE' });
ManufacturingRecipe.belongsTo(Product, { as: 'variantProduct', foreignKey: 'variantProductId', onDelete: 'CASCADE' });

makeMongooseCompatible(ManufacturingRecipe, {
  product: 'productId',
  variantProduct: 'variantProductId',
});

module.exports = ManufacturingRecipe;
