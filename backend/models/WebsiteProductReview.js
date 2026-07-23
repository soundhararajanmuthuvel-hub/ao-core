const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteProductReview = sequelize.define(
  'WebsiteProductReview',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    productSlug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reviewerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    reviewText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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

makeMongooseCompatible(WebsiteProductReview);

module.exports = WebsiteProductReview;
