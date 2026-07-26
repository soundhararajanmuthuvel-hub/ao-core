const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const Supplier = require('./Supplier');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const StockMovement = sequelize.define('StockMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  referenceModel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['productId'] },
    { fields: ['createdAt'] }
  ]
});

// Associations
StockMovement.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'RESTRICT' });
StockMovement.belongsTo(Supplier, { as: 'supplier', foreignKey: 'supplierId', onDelete: 'RESTRICT' });
StockMovement.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'RESTRICT' });

makeMongooseCompatible(StockMovement, {
  product: 'productId',
  supplier: 'supplierId',
  createdBy: 'createdById',
});

module.exports = StockMovement;
