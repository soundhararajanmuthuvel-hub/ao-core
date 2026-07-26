const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('info', 'warning', 'error', 'success'),
    defaultValue: 'info',
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// Associations
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });

makeMongooseCompatible(Notification, { user: 'userId' });

module.exports = Notification;
