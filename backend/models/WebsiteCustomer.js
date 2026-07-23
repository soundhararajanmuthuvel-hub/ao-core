const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');
const { makeMongooseCompatible } = require('./compat');

const WebsiteCustomer = sequelize.define(
  'WebsiteCustomer',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    referralCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    accountCredit: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    defaultScope: {
      attributes: { exclude: ['password'] },
    },
    scopes: {
      withPassword: {
        attributes: {},
      },
    },
    hooks: {
      beforeSave: async (customer) => {
        if (customer.changed('password') && customer.password) {
          customer.password = await bcrypt.hash(customer.password, 10);
        }
        if (!customer.referralCode) {
          const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
          customer.referralCode = `BLO-${randomHex}`;
        }
      },
    },
    timestamps: true,
  }
);

WebsiteCustomer.prototype.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

makeMongooseCompatible(WebsiteCustomer);

module.exports = WebsiteCustomer;
