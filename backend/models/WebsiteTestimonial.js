const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteTestimonial = sequelize.define(
  'WebsiteTestimonial',
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
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reviewText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    productMentioned: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteTestimonial);

module.exports = WebsiteTestimonial;
