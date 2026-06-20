const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const CrmOpportunity = sequelize.define('CrmOpportunity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  value: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  stage: {
    type: DataTypes.ENUM('Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'),
    defaultValue: 'Qualification',
  },
  closeDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
});

CrmOpportunity.belongsTo(require('./Lead'), { as: 'lead', foreignKey: 'leadId', onDelete: 'CASCADE' });
CrmOpportunity.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });

makeMongooseCompatible(CrmOpportunity, {
  lead: 'leadId',
  customer: 'customerId',
});

module.exports = CrmOpportunity;
