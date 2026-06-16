const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');
const {
  GST_REGISTRATION_TYPES,
  getStateCodeByName,
  getStateNameByCode,
  getGstinStateCode,
  isValidGstin,
  isValidPan,
} = require('../utils/gst');

const Supplier = sequelize.define('Supplier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('general', 'packaging', 'raw_material'),
    defaultValue: 'general',
  },
  gstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  gstRegistrationType: {
    type: DataTypes.ENUM(...GST_REGISTRATION_TYPES),
    allowNull: false,
    defaultValue: 'Regular',
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  stateCode: {
    type: DataTypes.STRING(2),
    allowNull: true,
    defaultValue: '',
  },
  panNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  tdsApplicable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

Supplier.addHook('beforeValidate', (supplier) => {
  if (supplier.gstNumber) {
    supplier.gstNumber = String(supplier.gstNumber).trim().toUpperCase();
  } else {
    supplier.gstNumber = '';
  }

  const isRegistered = !!supplier.gstNumber;

  if (isRegistered) {
    supplier.gstRegistrationType = 'Regular';
    
    // Auto-detect state code and state name
    const gstStateCode = getGstinStateCode(supplier.gstNumber);
    if (gstStateCode) {
      supplier.stateCode = gstStateCode;
      supplier.state = getStateNameByCode(gstStateCode);
    }
    
    // Auto-extract PAN (chars 2-12)
    if (supplier.gstNumber.length >= 12) {
      supplier.panNumber = supplier.gstNumber.slice(2, 12);
    }
    
    supplier.tdsApplicable = false;

    // Validate GSTIN format
    if (!isValidGstin(supplier.gstNumber)) {
      throw new Error('GST number must be a valid 15-character GSTIN');
    }
  } else {
    // Unregistered supplier
    supplier.gstRegistrationType = 'Unregistered';
    supplier.gstNumber = '';
    supplier.stateCode = '';
    supplier.state = '';
    supplier.panNumber = '';
    supplier.tdsApplicable = false;
  }
});

makeMongooseCompatible(Supplier);

module.exports = Supplier;
