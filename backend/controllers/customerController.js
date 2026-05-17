const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { logActivity } = require('../utils/helpers');

exports.getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const query = search
      ? {
          $or: [
            { name: new RegExp(search, 'i') },
            { phone: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
          ],
        }
      : {};
    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ customers, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.getCustomerSales = async (req, res, next) => {
  try {
    const sales = await Invoice.find({ customer: req.params.id })
      .sort({ date: -1 })
      .limit(50);
    res.json({ sales });
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    await logActivity(req.user._id, 'create', 'customers', `Created customer ${customer.name}`);
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await logActivity(req.user._id, 'update', 'customers', `Updated customer ${customer.name}`);
    res.json({ customer });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await logActivity(req.user._id, 'delete', 'customers', `Deleted customer ${customer.name}`);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};
