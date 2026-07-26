const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const AccountCategory = require('./AccountCategory');

const LedgerAccount = sequelize.define('LedgerAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // e.g., '1000' for Cash, '1200' for AR
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // e.g., 'Accounts Receivable - Narpavi Honey'
  },
  systemType: {
    type: DataTypes.STRING,
    allowNull: true, // e.g., 'AR', 'AP', 'Cash', 'Revenue', 'COGS'
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true, // e.g., customerId or supplierId
  },
  referenceModel: {
    type: DataTypes.STRING,
    allowNull: true, // e.g., 'Customer' or 'Supplier'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  indexes: [
    { fields: ['code'] },
    { fields: ['systemType'] },
    { fields: ['referenceModel', 'referenceId'] }
  ]
});

LedgerAccount.belongsTo(AccountCategory, { as: 'category', foreignKey: 'categoryId', onDelete: 'RESTRICT' });

module.exports = LedgerAccount;
