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
});

ManufacturingRecipe.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(ManufacturingRecipe, {
  product: 'productId',
});

module.exports = ManufacturingRecipe;
