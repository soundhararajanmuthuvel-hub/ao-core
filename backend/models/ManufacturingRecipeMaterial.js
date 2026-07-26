const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ManufacturingRecipe = require('./ManufacturingRecipe');
const RawMaterial = require('./RawMaterial');
const { makeMongooseCompatible } = require('./compat');

const ManufacturingRecipeMaterial = sequelize.define('ManufacturingRecipeMaterial', {
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

ManufacturingRecipeMaterial.belongsTo(ManufacturingRecipe, { as: 'recipe', foreignKey: 'recipeId', onDelete: 'CASCADE' });
ManufacturingRecipe.hasMany(ManufacturingRecipeMaterial, { as: 'materials', foreignKey: 'recipeId', onDelete: 'CASCADE' });

ManufacturingRecipeMaterial.belongsTo(RawMaterial, { as: 'rawMaterial', foreignKey: 'rawMaterialId', onDelete: 'CASCADE' });

makeMongooseCompatible(ManufacturingRecipeMaterial, {
  recipe: 'recipeId',
  rawMaterial: 'rawMaterialId',
});

module.exports = ManufacturingRecipeMaterial;
