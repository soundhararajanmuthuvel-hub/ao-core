const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WhatsAppSettings = sequelize.define('WhatsAppSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  provider: {
    type: DataTypes.STRING,
    defaultValue: 'CRM WhatsApp',
  },
  apiUrl: {
    type: DataTypes.STRING,
    defaultValue: 'http://localhost:5000/api/whatsapp/mock-crm',
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instanceId: {
    type: DataTypes.STRING,
    defaultValue: 'default',
  },
  crmBaseUrl: {
    type: DataTypes.STRING,
    defaultValue: 'http://localhost:5000/api/whatsapp/mock-crm',
  },
  crmApiKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  crmSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Disconnected',
  }
});

makeMongooseCompatible(WhatsAppSettings);

module.exports = WhatsAppSettings;
