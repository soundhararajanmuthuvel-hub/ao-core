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
    allowNull: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  followUpDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'Call Customer', // Call Customer, Visit Customer, Send Catalog, Send Offer, Send Sample
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Completed', 'Missed'),
    defaultValue: 'Pending',
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
});

const Customer = require('./Customer');
const User = require('./User');
const Lead = require('./Lead');

CrmFollowUp.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Customer.hasMany(CrmFollowUp, { as: 'followUps', foreignKey: 'customerId', onDelete: 'CASCADE' });

CrmFollowUp.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId', onDelete: 'CASCADE' });
Lead.hasMany(CrmFollowUp, { as: 'followUps', foreignKey: 'leadId', onDelete: 'CASCADE' });

CrmFollowUp.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });

makeMongooseCompatible(CrmFollowUp, {
  customer: 'customerId',
  lead: 'leadId',
  createdBy: 'createdById',
});

module.exports = CrmFollowUp;
