const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const JournalEntry = require('./JournalEntry');
const LedgerAccount = require('./LedgerAccount');

const JournalLine = sequelize.define('JournalLine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  journalEntryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  debit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  credit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  indexes: [
    { fields: ['journalEntryId'] },
    { fields: ['accountId'] }
  ]
});

JournalLine.belongsTo(JournalEntry, { as: 'journalEntry', foreignKey: 'journalEntryId', onDelete: 'CASCADE' });
JournalEntry.hasMany(JournalLine, { as: 'lines', foreignKey: 'journalEntryId', onDelete: 'CASCADE' });

JournalLine.belongsTo(LedgerAccount, { as: 'account', foreignKey: 'accountId', onDelete: 'RESTRICT' });

module.exports = JournalLine;
