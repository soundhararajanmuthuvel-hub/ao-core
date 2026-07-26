const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');
const User = require('./User');
const { makeMongooseCompatible } = require('./compat');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  shipmentNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  courier: {
    type: DataTypes.STRING,
    defaultValue: 'Professional Couriers',
  },
  shipmentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expectedDeliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveredDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Packed', 'Dispatched', 'In Transit', 'Out For Delivery', 'Delivered', 'Returned', 'Cancelled'),
    defaultValue: 'Pending',
  },
  trackingTimeline: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  courierStatus: {
    type: DataTypes.ENUM('Pending', 'In Transit', 'Out For Delivery', 'Delivered', 'Returned'),
    defaultValue: 'Pending',
  },
  courierTimeline: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  lastKnownLocation: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  courierDeliveredDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  packageWeight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  packageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  deliveryStaffId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  vehicleNumber: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  deliveryRoute: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  deliveryLatitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  deliveryLongitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  deliveryCommitment: {
    type: DataTypes.ENUM('Same Day', 'Next Day'),
    defaultValue: 'Same Day',
  },
  expectedArrivalTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliverySequence: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  indexes: [
    { fields: ['invoiceId'] },
    { fields: ['status'] }
  ]
});

// Associations
Shipment.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'RESTRICT' });
Invoice.hasMany(Shipment, { as: 'shipments', foreignKey: 'invoiceId', onDelete: 'RESTRICT' });
Shipment.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'RESTRICT' });
Shipment.belongsTo(User, { as: 'deliveryStaff', foreignKey: 'deliveryStaffId', onDelete: 'SET NULL' });

// We define Courier relation inline to prevent circular references during module initialization
const Courier = require('./Courier');
Shipment.belongsTo(Courier, { as: 'courierInfo', foreignKey: 'courierId', onDelete: 'SET NULL' });
Courier.hasMany(Shipment, { as: 'shipments', foreignKey: 'courierId', onDelete: 'SET NULL' });

makeMongooseCompatible(Shipment, {
  invoice: 'invoiceId',
  createdBy: 'createdById',
  courierInfo: 'courierId',
  deliveryStaff: 'deliveryStaffId',
});

const pushWooShipmentDetails = async (shipment) => {
  try {
    const Invoice = require('./Invoice');
    const Settings = require('./Settings');
    const WooCommerceService = require('../utils/wooService');

    const invoice = await Invoice.findByPk(shipment.invoiceId);
    if (invoice && invoice.wooOrderId) {
      const settings = await Settings.findOne();
      if (settings && settings.wooConnected) {
        const woo = new WooCommerceService(settings);
        const trackingUrl = `http://localhost:5173/track/${shipment.trackingNumber}`;
        await woo.pushShipmentDetails(
          invoice.wooOrderId,
          shipment.trackingNumber || '',
          shipment.courier || '',
          trackingUrl,
          shipment.status || 'Pending'
        );
      }
    }
  } catch (err) {
    console.error('[Shipment Hook Error] Failed to sync shipping info to WooCommerce:', err.message);
  }
};

Shipment.afterCreate(async (shipment) => {
  pushWooShipmentDetails(shipment);
});

Shipment.afterUpdate(async (shipment) => {
  if (shipment.changed('trackingNumber') || shipment.changed('status') || shipment.changed('courier')) {
    pushWooShipmentDetails(shipment);
  }
});

module.exports = Shipment;
