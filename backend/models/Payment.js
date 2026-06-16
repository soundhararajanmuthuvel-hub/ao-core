const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  paymentNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'upi',
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  allocations: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Success',
  }
});

const Customer = require('./Customer');
Payment.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });

makeMongooseCompatible(Payment, { customer: 'customerId' });

module.exports = Payment;
