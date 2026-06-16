const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const ActivityLog = sequelize.define('ActivityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  module: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

// Associations
ActivityLog.belongsTo(User, { as: 'user', foreignKey: 'userId' });

makeMongooseCompatible(ActivityLog, { user: 'userId' });

module.exports = ActivityLog;
