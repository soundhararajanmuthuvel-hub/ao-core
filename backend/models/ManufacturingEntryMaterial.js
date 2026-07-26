const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ManufacturingEntry = require('./ManufacturingEntry');
const RawMaterial = require('./RawMaterial');
const { makeMongooseCompatible } = require('./compat');

const ManufacturingEntryMaterial = sequelize.define('ManufacturingEntryMaterial', {
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
    defaultValue: 0,
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
});

ManufacturingEntryMaterial.belongsTo(ManufacturingEntry, { as: 'mfgEntry', foreignKey: 'mfgEntryId', onDelete: 'CASCADE' });
ManufacturingEntry.hasMany(ManufacturingEntryMaterial, { as: 'materials', foreignKey: 'mfgEntryId', onDelete: 'CASCADE' });

ManufacturingEntryMaterial.belongsTo(RawMaterial, { as: 'rawMaterial', foreignKey: 'rawMaterialId', onDelete: 'CASCADE' });

makeMongooseCompatible(ManufacturingEntryMaterial, {
  mfgEntry: 'mfgEntryId',
  rawMaterial: 'rawMaterialId',
});

module.exports = ManufacturingEntryMaterial;
