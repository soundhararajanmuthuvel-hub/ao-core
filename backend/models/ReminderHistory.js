const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const ReminderHistory = sequelize.define('ReminderHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dateSent: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  channel: {
    type: DataTypes.ENUM('WhatsApp', 'PDF', 'JPG', 'Email'),
    allowNull: false,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
});

const Customer = require('./Customer');
const User = require('./User');

ReminderHistory.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Customer.hasMany(ReminderHistory, { as: 'reminders', foreignKey: 'customerId', onDelete: 'CASCADE' });

ReminderHistory.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(ReminderHistory, {
  customer: 'customerId',
  createdBy: 'createdById',
});

module.exports = ReminderHistory;
