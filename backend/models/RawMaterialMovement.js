const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const RawMaterial = require('./RawMaterial');
const Supplier = require('./Supplier');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const RawMaterialMovement = sequelize.define('RawMaterialMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.ENUM('purchase', 'adjustment', 'consumption'),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  referenceModel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paymentStatus: {
    type: DataTypes.ENUM('Paid', 'Pending'),
    defaultValue: 'Pending',
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

RawMaterialMovement.belongsTo(RawMaterial, { as: 'rawMaterial', foreignKey: 'rawMaterialId', onDelete: 'CASCADE' });
RawMaterial.hasMany(RawMaterialMovement, { as: 'movements', foreignKey: 'rawMaterialId', onDelete: 'CASCADE' });

RawMaterialMovement.belongsTo(Supplier, { as: 'supplier', foreignKey: 'supplierId' });
RawMaterialMovement.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

makeMongooseCompatible(RawMaterialMovement, {
  rawMaterial: 'rawMaterialId',
  supplier: 'supplierId',
  createdBy: 'createdById',
});

module.exports = RawMaterialMovement;
