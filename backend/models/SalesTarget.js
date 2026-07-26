const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const SalesTarget = sequelize.define('SalesTarget', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  targetType: {
    type: DataTypes.ENUM('Company', 'Product', 'Customer', 'Salesman', 'Category', 'Brand'),
    allowNull: false,
  },
  targetPeriod: {
    type: DataTypes.ENUM('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly'),
    allowNull: false,
    defaultValue: 'Monthly',
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: true, // 1-12
  },
  valueType: {
    type: DataTypes.ENUM('Revenue', 'Quantity', 'Weight', 'Orders', 'New Customers', 'Collections', 'Visits'),
    allowNull: false,
    defaultValue: 'Revenue',
  },
  targetValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  actualValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  // Reference identifiers
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
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
});

SalesTarget.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'salesmanId', onDelete: 'SET NULL' });
SalesTarget.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
SalesTarget.belongsTo(require('./Product'), { as: 'product', foreignKey: 'productId', onDelete: 'CASCADE' });

makeMongooseCompatible(SalesTarget, {
  salesman: 'salesmanId',
  customer: 'customerId',
  product: 'productId',
});

module.exports = SalesTarget;
