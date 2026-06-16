const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const Customer = require('./Customer');
const { makeMongooseCompatible } = require('./compat');

const TradeScheme = sequelize.define('TradeScheme', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  buyQty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 10,
  },
  freeQty: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  customerType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
  },
});

TradeScheme.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
TradeScheme.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });

makeMongooseCompatible(TradeScheme, {
  product: 'productId',
  customer: 'customerId',
});

module.exports = TradeScheme;
