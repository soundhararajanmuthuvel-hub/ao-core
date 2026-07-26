const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const JournalEntry = sequelize.define('JournalEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  entryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  referenceModel: {
    type: DataTypes.STRING,
    allowNull: true, // e.g., 'Invoice', 'Payment', 'ManufacturingEntry'
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true, // e.g., 'INV-001'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Posted', 'Void'),
    defaultValue: 'Posted',
  }
}, {
  indexes: [
    { fields: ['entryDate'] },
    { fields: ['referenceModel', 'referenceId'] }
  ]
});

module.exports = JournalEntry;
