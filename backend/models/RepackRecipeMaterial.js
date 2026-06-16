const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const RepackRecipe = require('./RepackRecipe');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const RepackRecipeMaterial = sequelize.define('RepackRecipeMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  qty: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
  },
});

// Associations
RepackRecipeMaterial.belongsTo(RepackRecipe, { as: 'recipe', foreignKey: 'recipeId', onDelete: 'CASCADE' });
RepackRecipe.hasMany(RepackRecipeMaterial, { as: 'materials', foreignKey: 'recipeId', onDelete: 'CASCADE' });

RepackRecipeMaterial.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(RepackRecipeMaterial, {
  recipe: 'recipeId',
  product: 'productId',
});

module.exports = RepackRecipeMaterial;
