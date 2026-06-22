const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationFieldMapping = sequelize.define('IntegrationFieldMapping', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING, // 'Product', 'Customer', 'Order', 'Catalogue'
    allowNull: false,
  },
  externalField: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  internalField: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_field_mappings',
  timestamps: true,
});

makeMongooseCompatible(IntegrationFieldMapping);

module.exports = IntegrationFieldMapping;
