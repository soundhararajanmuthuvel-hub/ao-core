const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const MigrationDetailLog = sequelize.define('MigrationDetailLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  migrationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  level: {
    type: DataTypes.STRING, // 'INFO', 'WARNING', 'ERROR', 'DUPLICATE'
    allowNull: false,
    defaultValue: 'INFO',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

makeMongooseCompatible(MigrationDetailLog);

module.exports = MigrationDetailLog;
