const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Customer = require('./Customer');
const Invoice = require('./Invoice');
const { makeMongooseCompatible } = require('./compat');

const ReturnCreditNote = sequelize.define('ReturnCreditNote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  creditNoteNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  returnRequestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  taxableValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  cgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  igstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Posted', 'Adjusted', 'Cancelled'),
    defaultValue: 'Posted',
  },
  postingDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: true,
});

ReturnCreditNote.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
ReturnCreditNote.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'CASCADE' });

makeMongooseCompatible(ReturnCreditNote, {
  customer: 'customerId',
  invoice: 'invoiceId',
});

module.exports = ReturnCreditNote;
