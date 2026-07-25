const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const ProductShelfLifeRule = sequelize.define('ProductShelfLifeRule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  totalShelfLifeDays: {
    type: DataTypes.INTEGER,
    defaultValue: 180,
  },
  warningDays: {
    type: DataTypes.INTEGER,
    defaultValue: 60, // E.g., ABC Malt 60d, Beetroot Malt 45d
  },
  criticalDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  recommendedAction: {
    type: DataTypes.STRING,
    defaultValue: 'Transfer to Fast Selling Shop',
  }
}, {
  timestamps: true,
});

ProductShelfLifeRule.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(ProductShelfLifeRule, {
  product: 'productId',
});

module.exports = ProductShelfLifeRule;
