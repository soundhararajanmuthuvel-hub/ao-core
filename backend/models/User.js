const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');
const { makeMongooseCompatible } = require('./compat');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(
        'admin',
        'Super Admin',
        'Manufacturing Manager',
        'Billing Executive',
        'Store Keeper',
        'Dispatch Executive',
        'Sales Executive'
      ),
      defaultValue: 'Super Admin',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
      beforeSave: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

// Method to verify candidate password
User.prototype.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Add Mongoose compatibility layers
makeMongooseCompatible(User);

module.exports = User;
