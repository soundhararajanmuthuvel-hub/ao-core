const { Op } = require('sequelize');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Shipment = require('../models/Shipment');
const { logActivity } = require('../utils/helpers');

exports.getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = {};
    if (req.query.type) {
      query.customerType = req.query.type;
    }
    if (req.query.status) {
      query.status = req.query.status;
    } else {
      query.status = { [Op.ne]: 'Archived' };
    }
    if (search) {
      query[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { businessName: { [Op.like]: `%${search}%` } },
        { gstin: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
      ];
    }


    const { count: total, rows: customers } = await Customer.findAndCountAll({
      where: query,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ customers, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const customer = await Customer.findByPk(req.params.id, {
      include: [{ model: User, as: 'salesman', attributes: ['id', 'name'] }]
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer360Profile = async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    let invoices = [];
    try {
      invoices = await Invoice.findAll({
        where: { customerId },
        order: [['createdAt', 'DESC']],
        limit: 100
      });
    } catch (e) {
      console.error('Error fetching invoices for 360 profile:', e.message);
    }

    let returnsList = [];
    try {
      const ReturnRequest = require('../models/ReturnRequest');
      if (ReturnRequest) {
        returnsList = await ReturnRequest.findAll({
          where: { [Op.or]: [{ customerId }, { customerName: customer.name }] },
          order: [['createdAt', 'DESC']],
          limit: 100
        });
      }
    } catch (e) {
      console.error('Error fetching returns for 360 profile:', e.message);
    }

    let payments = [];
    try {
      const Payment = require('../models/Payment');
      if (Payment) {
        payments = await Payment.findAll({
          where: { customerId },
          order: [['createdAt', 'DESC']],
          limit: 50
        });
      }
    } catch (e) {
      console.error('Error fetching payments for 360 profile:', e.message);
    }

    const totalOrders = invoices.length;
    const completedOrders = invoices.filter(i => i.status !== 'Cancelled').length;
    const totalSales = invoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
    const avgOrderVal = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0;
    const lastInvoice = invoices.length > 0 ? invoices[0] : null;

    const totalReturns = returnsList.length;
    const returnRate = totalOrders > 0 ? ((totalReturns / totalOrders) * 100).toFixed(1) : 0;
    const recoveryValue = returnsList.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0);
    const creditNotes = returnsList.filter(r => r.status === 'Closed').length;

    const outstanding = Number(customer.balance || customer.outstandingAmount || 0);
    const creditLimit = Number(customer.creditLimit || 50000);
    const availableCredit = creditLimit - outstanding;
    const lastPayment = payments.length > 0 ? payments[0] : null;

    let riskLevel = 'Low';
    if (returnRate > 15 || outstanding > 10000) riskLevel = 'High';
    else if (returnRate > 5 || outstanding > 0) riskLevel = 'Medium';

    const profileData = {
      success: true,
      customer: {
        id: customer.id,
        code: customer.code || `CUS-${String(customer.id).padStart(6, '0')}`,
        name: customer.name,
        businessName: customer.businessName || customer.name,
        ownerName: customer.ownerName || customer.name,
        customerType: customer.customerType || 'Retail Shop',
        phone: customer.phone || 'N/A',
        whatsapp: customer.phone || 'N/A',
        email: customer.email || 'N/A',
        gstin: customer.gstin || 'Unregistered',
        pan: customer.pan || 'N/A',
        fssai: customer.fssai || 'N/A',
        address: customer.address || 'Chennai, Tamil Nadu',
        city: customer.city || 'Chennai',
        district: customer.district || 'Chennai',
        state: customer.state || 'Tamil Nadu',
        pincode: customer.pincode || '600001',
        salesman: customer.assignedSalesmanId ? { name: 'Sales Representative' } : null,
        route: customer.route || 'Central Metro Logistics Route',
        status: customer.status || 'Active',
        balance: outstanding,
        creditLimit,
        paymentTerms: customer.paymentTerms || 'Net 30 Days',
        createdAt: customer.createdAt
      },
      salesSummary: {
        totalOrders,
        completedOrders,
        totalSales,
        avgOrderVal,
        lastInvoiceNumber: lastInvoice ? lastInvoice.invoiceNumber : 'None',
        lastOrderDate: lastInvoice ? lastInvoice.createdAt : null
      },
      returnSummary: {
        totalReturns,
        returnRate,
        recoveryValue,
        creditNotes,
        lastReturnDate: returnsList.length > 0 ? returnsList[0].createdAt : null,
        riskLevel
      },
      accounts: {
        outstanding,
        creditLimit,
        availableCredit,
        lastPaymentAmount: lastPayment ? lastPayment.amount : 0,
        lastPaymentDate: lastPayment ? lastPayment.createdAt : null,
        paymentTerms: customer.paymentTerms || 'Net 30 Days'
      },
      invoices,
      returns: returnsList,
      payments
    };

    return res.json(profileData);
  } catch (err) {
    console.error('Error compiling 360 profile:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error compiling customer profile' });
  }
};

exports.getCustomerSales = async (req, res, next) => {
  try {
    const sales = await Invoice.findAll({
      where: { customerId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ sales });
  } catch (err) {
    console.error('Error fetching customer sales:', err);
    res.json({ sales: [] });
  }
};


exports.getCustomerPayments = async (req, res, next) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.findAll({
      where: { customerId: req.params.id },
      order: [['date', 'DESC']],
      limit: 100
    });
    res.json({ payments });
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    await logActivity(req.user.id, 'create', 'customers', `Created customer ${customer.name}`);
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    
    await customer.update(req.body);
    await logActivity(req.user.id, 'update', 'customers', `Updated customer ${customer.name}`);
    res.json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    
    await customer.destroy();
    await logActivity(req.user.id, 'delete', 'customers', `Deleted customer ${customer.name}`);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};

const CrmNote = require('../models/CrmNote');
const CrmFollowUp = require('../models/CrmFollowUp');
const ReminderHistory = require('../models/ReminderHistory');
const Order = require('../models/Order');
const User = require('../models/User');

// Soft Delete (Archive)
exports.archiveCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    await customer.update({ status: 'Archived' });
    await logActivity(req.user.id, 'update', 'customers', `Archived customer ${customer.name}`);
    res.json({ success: true, message: 'Customer archived successfully', customer });
  } catch (err) {
    next(err);
  }
};

// Restore Customer
exports.restoreCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    await customer.update({ status: 'Active' });
    await logActivity(req.user.id, 'update', 'customers', `Restored customer ${customer.name}`);
    res.json({ success: true, message: 'Customer restored successfully', customer });
  } catch (err) {
    next(err);
  }
};

// Dependencies Check
exports.getCustomerDependencies = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findByPk(customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const invoicesCount = await Invoice.count({ where: { customerId } });
    const ordersCount = await Order.count({ where: { customerId } });
    const Payment = require('../models/Payment');
    const paymentsCount = await Payment.count({ where: { customerId } });
    const shipmentsCount = await Shipment.count({
      include: [{
        model: Invoice,
        as: 'invoice',
        where: { customerId }
      }]
    });
    const notesCount = await CrmNote.count({ where: { customerId } });
    const followUpsCount = await CrmFollowUp.count({ where: { customerId } });

    // Outstanding Dues - sum of unpaid invoice balances
    const unpaidInvoices = await Invoice.findAll({
      where: {
        customerId,
        paymentStatus: { [Op.notIn]: ['paid', 'PAID'] },
        status: { [Op.notIn]: ['Cancelled', 'Draft'] } // draft shouldn't be counted in outstanding
      }
    });

    let computedOutstanding = 0;
    unpaidInvoices.forEach(inv => {
      const balance = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      if (balance > 0) computedOutstanding += balance;
    });

    // Fallback to customer's stored balance if computed outstanding is 0 but balance is positive
    const outstanding = computedOutstanding > 0 ? computedOutstanding : Number(customer.balance || 0);

    const counts = {
      invoices: invoicesCount,
      orders: ordersCount,
      payments: paymentsCount,
      shipments: shipmentsCount,
      notes: notesCount,
      followUps: followUpsCount
    };

    const hasDependencies = invoicesCount > 0 || ordersCount > 0 || paymentsCount > 0 || shipmentsCount > 0 || notesCount > 0 || followUpsCount > 0 || outstanding > 0;

    res.json({
      success: true,
      hasDependencies,
      counts,
      outstanding
    });
  } catch (err) {
    next(err);
  }
};

// Notes API
exports.getCrmNotes = async (req, res, next) => {
  try {
    const notes = await CrmNote.findAll({
      where: { customerId: req.params.id },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
};

exports.createCrmNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Note content is required' });

    const newNote = await CrmNote.create({
      customerId: req.params.id,
      note,
      createdById: req.user.id
    });

    const noteWithUser = await CrmNote.findByPk(newNote.id, {
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }]
    });

    await logActivity(req.user.id, 'create', 'customers', `Added CRM note to customer #${req.params.id}`);
    res.status(201).json({ success: true, note: noteWithUser });
  } catch (err) {
    next(err);
  }
};

// Follow-ups API
exports.getCrmFollowUps = async (req, res, next) => {
  try {
    const followUps = await CrmFollowUp.findAll({
      where: { customerId: req.params.id },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
      order: [['followUpDate', 'DESC']]
    });
    res.json({ followUps });
  } catch (err) {
    next(err);
  }
};

exports.createCrmFollowUp = async (req, res, next) => {
  try {
    const { followUpDate, notes } = req.body;
    if (!followUpDate) return res.status(400).json({ message: 'Follow up date is required' });

    const newFollowUp = await CrmFollowUp.create({
      customerId: req.params.id,
      followUpDate,
      notes,
      status: 'Pending',
      createdById: req.user.id
    });

    const followUpWithUser = await CrmFollowUp.findByPk(newFollowUp.id, {
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }]
    });

    await logActivity(req.user.id, 'create', 'customers', `Scheduled follow-up for customer #${req.params.id}`);
    res.status(201).json({ success: true, followUp: followUpWithUser });
  } catch (err) {
    next(err);
  }
};

exports.updateCrmFollowUp = async (req, res, next) => {
  try {
    const followUp = await CrmFollowUp.findOne({
      where: { id: req.params.followUpId, customerId: req.params.id }
    });
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' });

    await followUp.update(req.body);
    res.json({ success: true, followUp });
  } catch (err) {
    next(err);
  }
};

// Reminders API
exports.getReminderHistory = async (req, res, next) => {
  try {
    const reminders = await ReminderHistory.findAll({
      where: { customerId: req.params.id },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }],
      order: [['dateSent', 'DESC']]
    });
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
};

exports.createReminderHistory = async (req, res, next) => {
  try {
    const { channel, invoiceNumber, amount } = req.body;
    if (!channel) return res.status(400).json({ message: 'Channel is required' });

    const reminder = await ReminderHistory.create({
      customerId: req.params.id,
      channel,
      invoiceNumber,
      amount: amount || 0.00,
      createdById: req.user.id
    });

    // Also increment remindersSent on Customer profile
    const customer = await Customer.findByPk(req.params.id);
    if (customer) {
      await customer.increment('remindersSent', { by: 1 });
    }

    const reminderWithUser = await ReminderHistory.findByPk(reminder.id, {
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name'] }]
    });

    await logActivity(req.user.id, 'create', 'customers', `Logged sent ${channel} reminder to customer ${customer ? customer.name : ''}`);
    res.status(201).json({ success: true, reminder: reminderWithUser });
  } catch (err) {
    next(err);
  }
};
