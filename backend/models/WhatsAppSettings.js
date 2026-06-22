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
    type: DataTypes.ENUM('WAHA', 'Evolution API', 'UltraMsg', 'Green API', 'Meta Cloud API'),
    defaultValue: 'WAHA',
  },
  apiUrl: {
    type: DataTypes.STRING,
    defaultValue: 'http://localhost:3000',
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instanceId: {
    type: DataTypes.STRING,
    defaultValue: 'default',
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
