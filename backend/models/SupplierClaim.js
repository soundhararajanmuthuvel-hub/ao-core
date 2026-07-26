const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Supplier = require('./Supplier');
const { makeMongooseCompatible } = require('./compat');

const SupplierClaim = sequelize.define('SupplierClaim', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  claimNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  materialName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  defectiveQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  creditNoteStatus: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Issued', 'Rejected'),
    defaultValue: 'Pending',
  },
  creditNoteAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  replacementStatus: {
    type: DataTypes.ENUM('Pending', 'Dispatched', 'Received'),
    defaultValue: 'Pending',
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: true,
});

SupplierClaim.belongsTo(Supplier, { as: 'supplier', foreignKey: 'supplierId', onDelete: 'CASCADE' });

makeMongooseCompatible(SupplierClaim, {
  supplier: 'supplierId',
});

module.exports = SupplierClaim;
