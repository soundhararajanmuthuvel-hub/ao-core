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
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.getCustomerSales = async (req, res, next) => {
  try {
    const InvoiceItem = require('../models/InvoiceItem');
    const Product = require('../models/Product');
    // Search invoices by customerId foreign key with item/product populations
    const sales = await Invoice.findAll({
      where: { customerId: req.params.id },
      include: [
        { model: Shipment, as: 'shipments' },
        {
          model: InvoiceItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }]
        }
      ],
      order: [['date', 'DESC']],
      limit: 50,
    });
    res.json({ sales });
  } catch (err) {
    next(err);
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
