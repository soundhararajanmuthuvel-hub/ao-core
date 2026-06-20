const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Customer = require('./Customer');
const User = require('./User');
const InvoiceItem = require('./InvoiceItem');
const { makeMongooseCompatible } = require('./compat');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  gstTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  grandTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'bank', 'credit'),
    defaultValue: 'cash',
  },
  paymentStatus: {
    type: DataTypes.ENUM('paid', 'partial', 'pending', 'unpaid', 'overdue'),
    defaultValue: 'unpaid',
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  customerType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  salesChannel: {
    type: DataTypes.ENUM('White Label', 'Organic Store', 'Retail Shop', 'D2C', 'Distributor', 'Wholesale'),
    defaultValue: 'Retail Shop',
  },
  status: {
    type: DataTypes.ENUM(
      'Draft',
      'Confirmed',
      'Waiting For Stock',
      'Production Planned',
      'Manufacturing In Progress',
      'Ready To Dispatch',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Pending',
      'Returned'
    ),
    defaultValue: 'Confirmed',
  },
  expectedDispatchDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  commitment: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstBillingMode: {
    type: DataTypes.ENUM('exclusive', 'inclusive', 'no_gst'),
    defaultValue: 'exclusive',
  },
  shippingCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  packingCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  handlingCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  courierCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  otherCharge: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  packingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  handlingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  courierCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  loadingCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  roundOff: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  taxableValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  wooOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'invoice',
  },
});

// Associations
Invoice.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });
Invoice.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// An invoice has many items, which will be cascaded on deletion
Invoice.hasMany(InvoiceItem, { as: 'items', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId' });

makeMongooseCompatible(Invoice, {
  customer: 'customerId',
  createdBy: 'createdById',
});

async function updateCustomerLastOrder(invoice) {
  if (invoice.customerId && invoice.status !== 'Draft' && invoice.status !== 'Cancelled') {
    const Customer = require('./Customer');
    const CrmFollowUp = require('./CrmFollowUp');
    try {
      const customer = await Customer.findByPk(invoice.customerId);
      if (customer) {
        const invoiceDate = invoice.date ? new Date(invoice.date) : new Date(invoice.createdAt);
        if (!customer.lastOrderDate || invoiceDate > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = invoiceDate;
          await customer.save();
        }
        
        // Auto-complete pending re-engagement follow-ups
        await CrmFollowUp.update(
          {
            status: 'Completed',
            notes: `Recovery success! Customer placed order ${invoice.invoiceNumber}.`
          },
          {
            where: {
              customerId: customer.id,
              status: 'Pending'
            }
          }
        );
      }
    } catch (err) {
      console.error('Error updating customer last order date from invoice hook:', err);
    }
  }
}

Invoice.addHook('afterCreate', async (invoice, options) => {
  await updateCustomerLastOrder(invoice);
});

Invoice.addHook('afterUpdate', async (invoice, options) => {
  await updateCustomerLastOrder(invoice);
});

module.exports = Invoice;

