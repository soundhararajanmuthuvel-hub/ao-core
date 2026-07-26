const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const CustomerReview = sequelize.define('CustomerReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 5,
  },
  deliveryRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 5,
  },
  salesmanRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 5,
  },
  overallRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 5,
  },
  reviewText: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Submitted'),
    defaultValue: 'Pending',
  },
});

CustomerReview.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
CustomerReview.belongsTo(require('./Invoice'), { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'CASCADE' });

makeMongooseCompatible(CustomerReview, {
  customer: 'customerId',
  invoice: 'invoiceId',
});

module.exports = CustomerReview;
