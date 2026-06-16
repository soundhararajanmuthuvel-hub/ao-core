const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const CrmFollowUp = sequelize.define('CrmFollowUp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  followUpDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Completed'),
    defaultValue: 'Pending',
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
});

const Customer = require('./Customer');
const User = require('./User');

CrmFollowUp.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Customer.hasMany(CrmFollowUp, { as: 'followUps', foreignKey: 'customerId', onDelete: 'CASCADE' });

CrmFollowUp.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(CrmFollowUp, {
  customer: 'customerId',
  createdBy: 'createdById',
});

module.exports = CrmFollowUp;
