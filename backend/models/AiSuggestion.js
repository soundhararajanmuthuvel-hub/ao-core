const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const AiSuggestion = sequelize.define('AiSuggestion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  suggestions: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  generatedDate: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  }
});

makeMongooseCompatible(AiSuggestion);

module.exports = AiSuggestion;
