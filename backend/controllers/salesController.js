const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const { calcInvoiceTotals, getNextInvoiceNumber, logActivity, getSettings } = require('../utils/helpers');
const { updateStock } = require('../utils/stockService');

exports.getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const query = {};
    if (req.query.status) query.paymentStatus = req.query.status;
    if (search) query.invoiceNumber = new RegExp(search, 'i');
    const total = await Invoice.countDocuments(query);
    const sales = await Invoice.find(query)
      .populate('customer', 'name phone email')
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ sales, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getSale = async (req, res, next) => {
  try {
    const sale = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'name');
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    const settings = await getSettings();
    res.json({ sale, settings });
  } catch (err) {
    next(err);
  }
};

exports.createSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer, items, discount = 0, paymentMethod, paymentStatus, amountPaid, date } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Items required' });

    const enrichedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw new Error(`Product not found: ${item.product}`);
      if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);
      const lineTotal = item.qty * item.unitPrice * (1 + (item.gstPercent || 0) / 100);
      enrichedItems.push({
        product: product._id,
        name: product.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent || product.gstPercent,
        lineTotal,
        purchasePrice: product.purchasePrice,
      });
    }

    const totals = calcInvoiceTotals(enrichedItems, discount);
    const invoiceNumber = await getNextInvoiceNumber();

    const [sale] = await Invoice.create(
      [
        {
          invoiceNumber,
          customer,
          date: date || new Date(),
          items: enrichedItems,
          ...totals,
          discount,
          paymentMethod: paymentMethod || 'cash',
          paymentStatus: paymentStatus || 'paid',
          amountPaid: amountPaid ?? totals.grandTotal,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    for (const item of enrichedItems) {
      await updateStock(item.product, -item.qty, {
        type: 'sale',
        referenceId: sale._id,
        referenceModel: 'Invoice',
        userId: req.user._id,
      });
    }

    if (paymentStatus === 'pending' || paymentStatus === 'partial') {
      const pending = totals.grandTotal - (amountPaid || 0);
      await Customer.findByIdAndUpdate(customer, { $inc: { balance: pending } }, { session });
    }

    await session.commitTransaction();
    await logActivity(req.user._id, 'create', 'sales', `Created invoice ${invoiceNumber}`);
    const populated = await Invoice.findById(sale._id).populate('customer', 'name phone email');
    res.status(201).json({ sale: populated });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

exports.deleteSale = async (req, res, next) => {
  try {
    const sale = await Invoice.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    for (const item of sale.items) {
      await updateStock(item.product, item.qty, {
        type: 'adjustment',
        referenceId: sale._id,
        referenceModel: 'Invoice',
        notes: 'Sale deleted - stock restored',
        userId: req.user._id,
      });
    }
    await Invoice.findByIdAndDelete(req.params.id);
    await logActivity(req.user._id, 'delete', 'sales', `Deleted invoice ${sale.invoiceNumber}`);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    next(err);
  }
};
