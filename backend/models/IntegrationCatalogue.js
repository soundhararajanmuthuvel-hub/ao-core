const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const IntegrationCatalogue = sequelize.define('IntegrationCatalogue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  connectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pdfUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  productMapping: {
    type: DataTypes.TEXT, // Store JSON string of product SKUs/IDs
    allowNull: true,
  },
  version: {
    type: DataTypes.STRING,
    defaultValue: '1.0.0',
  },
  tenantId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: 'integration_catalogues',
  timestamps: true,
});

makeMongooseCompatible(IntegrationCatalogue);

module.exports = IntegrationCatalogue;
