const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AccountCategory = sequelize.define('AccountCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // e.g. Assets, Liabilities, Equity, Revenue, Expenses
  },
  normalBalance: {
    type: DataTypes.ENUM('Debit', 'Credit'),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  }
});

module.exports = AccountCategory;
