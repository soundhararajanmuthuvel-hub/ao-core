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
  // REGRESSION NOTE: Do NOT rename this field to paidAmount or duplicate it without updating 
  // all references in backend/controllers/aiController.js, salesController.js, etc.
  // amountPaid is the single source of truth for the paid portion of the invoice.
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
  is_historical_data: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  invoiceType: {
    type: DataTypes.STRING,
    defaultValue: 'NON_GST',
  },
  gstMode: {
    type: DataTypes.STRING,
    defaultValue: 'None',
  },
  sellerGSTIN: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerGSTIN: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  placeOfSupply: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstApplicable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isGSTReportable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isGSTPortalExported: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  exportedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  hsnSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  taxableAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  cgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  igstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalGST: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
}, {
  indexes: [
    { fields: ['date'] },
    { fields: ['customerId'] },
    { fields: ['status'] },
    { fields: ['type'] }
  ]
});

// Associations
Invoice.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'CASCADE' });
Invoice.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'CASCADE' });

// An invoice has many items, which will be cascaded on deletion
Invoice.hasMany(InvoiceItem, { as: 'items', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { as: 'invoice', foreignKey: 'invoiceId', onDelete: 'CASCADE' });

makeMongooseCompatible(Invoice, {
  customer: 'customerId',
  createdBy: 'createdById',
});

async function updateCustomerLastOrder(invoice, options = {}) {
  const transaction = options.transaction || null;
  if (invoice.customerId && invoice.status !== 'Draft' && invoice.status !== 'Cancelled') {
    const Customer = require('./Customer');
    const CrmFollowUp = require('./CrmFollowUp');
    try {
      const customer = await Customer.findByPk(invoice.customerId, { transaction });
      if (customer) {
        const invoiceDate = invoice.date ? new Date(invoice.date) : new Date(invoice.createdAt);
        if (!customer.lastOrderDate || invoiceDate > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = invoiceDate;
          await customer.save({ transaction });
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
            },
            transaction
          }
        );
      }
    } catch (err) {
      console.error('Error updating customer last order date from invoice hook:', err);
    }
  }
}

Invoice.addHook('afterCreate', async (invoice, options) => {
  await updateCustomerLastOrder(invoice, options);
});

Invoice.addHook('afterUpdate', async (invoice, options) => {
  await updateCustomerLastOrder(invoice, options);
});

module.exports = Invoice;

