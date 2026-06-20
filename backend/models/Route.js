const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Route = sequelize.define('Route', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  customerSequence: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  totalDistance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  totalDuration: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
});

Route.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'salesmanId' });

makeMongooseCompatible(Route, {
  salesman: 'salesmanId',
});

module.exports = Route;
