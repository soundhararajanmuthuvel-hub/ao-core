const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const RepackRecipe = sequelize.define('RepackRecipe', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  recipeName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  finishedQty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1.00,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pcs',
  },
  wastagePercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
  },
});

// Associations
RepackRecipe.belongsTo(Product, { as: 'finishedProduct', foreignKey: 'finishedProductId', onDelete: 'CASCADE' });

makeMongooseCompatible(RepackRecipe, {
  finishedProduct: 'finishedProductId',
});

module.exports = RepackRecipe;
