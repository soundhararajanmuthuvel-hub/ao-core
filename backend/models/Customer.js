const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerCode: {
    type: DataTypes.STRING,
    allowNull: true,
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
  gstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerType: {
    type: DataTypes.ENUM(
      'White Label',
      'Organic Store',
      'Retail Shop',
      'D2C Customer',
      'Distributor',
      'Wholesaler',
      'Super Market',
      'Pharmacy',
      'Export Customer'
    ),
    defaultValue: 'Retail Shop',
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  creditLimit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentTerms: {
    type: DataTypes.STRING,
    defaultValue: 'COD',
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Archived'),
    defaultValue: 'Active',
  },
  // White Label Fields
  brandName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  labelDesignRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  packagingType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  moq: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  specialPricing: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  manufacturingNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Organic Store Fields
  storeCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // D2C Fields
  gstBillingMode: {
    type: DataTypes.ENUM('default', 'registered', 'inclusive', 'exclusive', 'no_gst'),
    defaultValue: 'default',
  },
  wooCustomerId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remindersSent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  paymentCycle: {
    type: DataTypes.STRING,
    defaultValue: 'Bill to Bill',
  },
  creditDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  averagePaymentDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  billToBillEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  invoiceOutstandingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tier: {
    type: DataTypes.ENUM('GREEN', 'YELLOW', 'RED'),
    defaultValue: 'RED',
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  territory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  routeZone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assignedSalesmanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lastVisitDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastOrderDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

Customer.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'assignedSalesmanId' });

makeMongooseCompatible(Customer, {
  salesman: 'assignedSalesmanId',
});

// Territory & Customer ID Assignment Hook
const territoryService = require('../utils/territoryService');

async function assignTerritoryAndCode(customer) {
  let resolution = null;

  // If address changed, but coordinates did NOT change, clear old coordinates to force re-geocoding
  if (customer.changed('address') && !customer.changed('latitude') && !customer.changed('longitude')) {
    customer.latitude = null;
    customer.longitude = null;
  }

  if (customer.changed('territory') && customer.territory) {
    resolution = territoryService.resolveByTerritoryName(customer.territory);
  }

  if (!resolution) {
    resolution = territoryService.resolveTerritoryAndSalesman(
      customer.latitude,
      customer.longitude,
      customer.address
    );
  }

  if (resolution) {
    customer.latitude = resolution.latitude;
    customer.longitude = resolution.longitude;
    customer.territory = resolution.territory;
    customer.routeZone = resolution.routeZone;

    let salesmanId = resolution.assignedSalesmanId;
    if (salesmanId) {
      const User = require('./User');
      const userExists = await User.count({ where: { id: salesmanId } });
      if (userExists === 0) {
        const fallbackSalesman = await User.findOne({
          where: {
            role: {
              [require('sequelize').Op.in]: ['Salesman', 'Sales Executive']
            }
          }
        });
        salesmanId = fallbackSalesman ? fallbackSalesman.id : null;
      }
    }
    customer.assignedSalesmanId = salesmanId;

    const territoryCode = resolution.routeZone;
    const currentCode = customer.customerCode;
    if (!currentCode || !currentCode.startsWith(`${territoryCode}-`)) {
      const generatedCode = await territoryService.generateUniqueCustomerCode(Customer, territoryCode);
      customer.customerCode = generatedCode;
    }
  }
}

Customer.addHook('beforeCreate', async (customer, options) => {
  await assignTerritoryAndCode(customer);
});

Customer.addHook('beforeUpdate', async (customer, options) => {
  if (
    customer.changed('address') ||
    customer.changed('latitude') ||
    customer.changed('longitude') ||
    customer.changed('territory')
  ) {
    await assignTerritoryAndCode(customer);
  }
});

module.exports = Customer;
