const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const ManufacturingNcr = sequelize.define('ManufacturingNcr', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ncrNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  triggerReturnCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  assignedQaUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Open', 'Under Investigation', 'CAPA Pending', 'Verified', 'Closed'),
    defaultValue: 'Open',
  },
  rootCauseCategory: {
    type: DataTypes.STRING,
    defaultValue: 'Manufacturing',
  },
  rootCauseDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  correctiveAction: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  preventiveAction: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responsibleEmployee: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  verificationNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  timestamps: true,
});

ManufacturingNcr.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
ManufacturingNcr.belongsTo(User, { as: 'assignedQaUser', foreignKey: 'assignedQaUserId' });

makeMongooseCompatible(ManufacturingNcr, {
  product: 'productId',
  assignedQaUser: 'assignedQaUserId',
});

module.exports = ManufacturingNcr;
