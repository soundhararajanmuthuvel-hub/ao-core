const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const RepackEntry = require('./RepackEntry');
const Product = require('./Product');
const { makeMongooseCompatible } = require('./compat');

const RepackEntryMaterial = sequelize.define('RepackEntryMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  qtyUsed: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
});

// Associations
RepackEntryMaterial.belongsTo(RepackEntry, { as: 'repackEntry', foreignKey: 'repackEntryId', onDelete: 'CASCADE' });
RepackEntry.hasMany(RepackEntryMaterial, { as: 'materials', foreignKey: 'repackEntryId', onDelete: 'CASCADE' });

RepackEntryMaterial.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'CASCADE' });

makeMongooseCompatible(RepackEntryMaterial, {
  repackEntry: 'repackEntryId',
  product: 'productId',
});

module.exports = RepackEntryMaterial;
