const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  shopName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mobileNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  area: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  district: {
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
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  facebookPage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instagramPage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('New', 'Contacted', 'Assigned', 'Visited', 'Interested', 'Customer', 'Rejected'),
    defaultValue: 'New',
  },
  assignedSalesmanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
});

Lead.belongsTo(require('./User'), { as: 'salesman', foreignKey: 'assignedSalesmanId' });
Lead.belongsTo(require('./Customer'), { as: 'customer', foreignKey: 'customerId' });

makeMongooseCompatible(Lead, {
  salesman: 'assignedSalesmanId',
  customer: 'customerId',
});

async function validateLeadSalesman(lead) {
  let salesmanId = lead.assignedSalesmanId;
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
      lead.assignedSalesmanId = fallbackSalesman ? fallbackSalesman.id : null;
    }
  }
}

Lead.addHook('beforeCreate', async (lead, options) => {
  await validateLeadSalesman(lead);
});

Lead.addHook('beforeUpdate', async (lead, options) => {
  if (lead.changed('assignedSalesmanId')) {
    await validateLeadSalesman(lead);
  }
});

module.exports = Lead;
