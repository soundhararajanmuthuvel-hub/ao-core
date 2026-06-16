const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const CrmNote = sequelize.define('CrmNote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
});

const Customer = require('./Customer');
const User = require('./User');

CrmNote.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Customer.hasMany(CrmNote, { as: 'notes', foreignKey: 'customerId', onDelete: 'CASCADE' });

CrmNote.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(CrmNote, {
  customer: 'customerId',
  createdBy: 'createdById',
});

module.exports = CrmNote;
