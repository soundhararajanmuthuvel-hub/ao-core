const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const MigrationHistory = sequelize.define('MigrationHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  importDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  user: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'System',
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recordCount: {
    type: DataTypes.JSON, // { customers: X, products: Y, invoices: Z, payments: W }
    allowNull: false,
    defaultValue: {},
  },
  status: {
    type: DataTypes.STRING, // 'Completed', 'Failed', 'Rolled Back'
    allowNull: false,
    defaultValue: 'Completed',
  },
  snapshotData: {
    type: DataTypes.JSON, // { customers: [id1, id2], products: [id1], invoices: [id1], payments: [id1] }
    allowNull: true,
    defaultValue: {},
  },
});

makeMongooseCompatible(MigrationHistory);

module.exports = MigrationHistory;
