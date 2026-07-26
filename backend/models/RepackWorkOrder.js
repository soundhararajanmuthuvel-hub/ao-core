const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const RepackWorkOrder = sequelize.define('RepackWorkOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  workOrderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  returnRequestId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  pouchMaterialName: {
    type: DataTypes.STRING,
    defaultValue: 'Standard Pouch',
  },
  pouchQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  stickerQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  labelQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  cartonQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  printingLabelQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  batchStickerQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shrinkFilmQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tapeQtyDeducted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  operatorUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  laborHours: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 1.0,
  },
  repackCostTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'In Progress', 'QC Review', 'Completed', 'Cancelled'),
    defaultValue: 'In Progress',
  },
  qcApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: true,
});

RepackWorkOrder.belongsTo(Product, { as: 'product', foreignKey: 'productId', onDelete: 'CASCADE' });
RepackWorkOrder.belongsTo(User, { as: 'operator', foreignKey: 'operatorUserId', onDelete: 'CASCADE' });

makeMongooseCompatible(RepackWorkOrder, {
  product: 'productId',
  operator: 'operatorUserId',
});

module.exports = RepackWorkOrder;
