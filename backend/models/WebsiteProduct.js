const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteProduct = sequelize.define(
  'WebsiteProduct',
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
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    compareAtPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    images: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]', // JSON array of image URLs
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagePublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'General',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    benefits: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON array or text
    },
    ingredients: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON array or text
    },
    nutritionFacts: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON object or text
    },
    usageInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    faqs: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON array of FAQ objects
    },
    seoTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seoDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    seoKeywords: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    badges: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON array of badge strings
    },
    healthGoals: {
      type: DataTypes.TEXT,
      allowNull: true, // JSON array of goal strings
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isBestseller: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isTrending: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    galleryImages: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]',
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    managementProductId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = require('./Product');
WebsiteProduct.belongsTo(Product, { as: 'managementProduct', foreignKey: 'managementProductId' });
Product.hasOne(WebsiteProduct, { as: 'websiteProduct', foreignKey: 'managementProductId' });

makeMongooseCompatible(WebsiteProduct);

module.exports = WebsiteProduct;
