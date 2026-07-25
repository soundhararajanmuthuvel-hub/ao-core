const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('./Product');
const ReturnRequest = require('./ReturnRequest');
const { makeMongooseCompatible } = require('./compat');

const ReturnItem = sequelize.define('ReturnItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  returnRequestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  manufacturingDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  remainingShelfDays: {
    type: DataTypes.INTEGER,
    defaultValue: 90,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'Pks',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  lineTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  qcConditionProduct: {
    type: DataTypes.STRING, // Perfect, Damaged, Contaminated, Moisture, Leaked
    defaultValue: 'Perfect',
  },
  qcConditionPackage: {
    type: DataTypes.STRING, // Perfect, Torn, Dented, Crushed
    defaultValue: 'Perfect',
  },
  qcConditionSeal: {
    type: DataTypes.STRING, // Intact, Broken, Leaking
    defaultValue: 'Intact',
  },
  qcConditionLabel: {
    type: DataTypes.STRING, // Perfect, Torn, Missing, Misprinted
    defaultValue: 'Perfect',
  },
  qcWeightGrams: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  disposition: {
    type: DataTypes.ENUM(
      'Return to Saleable Stock',
      'Repack',
      'Rework',
      'Transfer to Fast Selling Shop',
      'Employee Sale',
      'Sample',
      'Scrap',
      'Destroy',
      'Return to Supplier',
      'Pending QC'
    ),
    defaultValue: 'Pending QC',
  },
  packagingFailureCategory: {
    type: DataTypes.ENUM(
      'None',
      'Torn Pouch',
      'Printing Error',
      'Label Error',
      'Seal Failure',
      'Zip Lock Failure',
      'Carton Damage'
    ),
    defaultValue: 'None',
  },
  aiRecommendation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  originalImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  returnedImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  qcImages: {
    type: DataTypes.TEXT, // JSON string
    allowNull: true,
  },
  repackedImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  voiceNotesUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  stockBucketSource: {
    type: DataTypes.STRING,
    defaultValue: 'Customer Return',
  },
  stockBucketDestination: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  timestamps: true,
});

ReturnItem.belongsTo(ReturnRequest, { as: 'returnRequest', foreignKey: 'returnRequestId', onDelete: 'CASCADE' });
ReturnRequest.hasMany(ReturnItem, { as: 'items', foreignKey: 'returnRequestId', onDelete: 'CASCADE' });
ReturnItem.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

makeMongooseCompatible(ReturnItem, {
  returnRequest: 'returnRequestId',
  product: 'productId',
});

module.exports = ReturnItem;
