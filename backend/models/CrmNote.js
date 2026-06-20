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
    allowNull: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
const Lead = require('./Lead');

CrmNote.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Customer.hasMany(CrmNote, { as: 'notes', foreignKey: 'customerId', onDelete: 'CASCADE' });

CrmNote.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId', onDelete: 'CASCADE' });
Lead.hasMany(CrmNote, { as: 'notes', foreignKey: 'leadId', onDelete: 'CASCADE' });

CrmNote.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(CrmNote, {
  customer: 'customerId',
  lead: 'leadId',
  createdBy: 'createdById',
});

module.exports = CrmNote;
