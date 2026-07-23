const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const WebsiteOrder = sequelize.define(
  'WebsiteOrder',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    websiteCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    guestName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    guestMobile: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    guestEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: false, // JSON string of address details
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    shippingCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    couponCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Paid', 'Packed', 'Shipped', 'Delivered', 'Cancelled'),
      defaultValue: 'Pending',
    },
    paymentStatus: {
      type: DataTypes.ENUM('Pending', 'Captured', 'Failed', 'Refunded'),
      defaultValue: 'Pending',
    },
    razorpayOrderId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    razorpayPaymentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    razorpaySignature: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    items: {
      type: DataTypes.TEXT,
      allowNull: false, // JSON string of ordered items [{ productId, name, price, qty, total }]
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    courierName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

makeMongooseCompatible(WebsiteOrder);

module.exports = WebsiteOrder;
