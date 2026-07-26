const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const SalesmanLocation = sequelize.define('SalesmanLocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

SalesmanLocation.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'salesmanId', onDelete: 'SET NULL' });

makeMongooseCompatible(SalesmanLocation, {
  salesman: 'salesmanId',
});

module.exports = SalesmanLocation;
