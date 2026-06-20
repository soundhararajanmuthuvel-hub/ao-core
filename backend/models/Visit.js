const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Visit = sequelize.define('Visit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  checkInTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  checkOutTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Visited', 'Order Taken', 'No Order', 'Closed Shop', 'Follow-Up Required'),
    defaultValue: 'Visited',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  photo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  distanceFromCustomer: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
});

Visit.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'salesmanId' });
Visit.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId' });
Visit.belongsTo(require('./Lead'), { as: 'lead', foreignKey: 'leadId' });

makeMongooseCompatible(Visit, {
  salesman: 'salesmanId',
  customer: 'customerId',
  lead: 'leadId',
});

module.exports = Visit;
