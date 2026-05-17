const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

exports.globalSearch = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) return res.json({ products: [], customers: [], invoices: [] });

    const regex = new RegExp(q, 'i');
    const [products, customers, invoices] = await Promise.all([
      Product.find({ $or: [{ name: regex }, { sku: regex }] }).limit(5).select('name sku stock'),
      Customer.find({ $or: [{ name: regex }, { phone: regex }, { email: regex }] }).limit(5).select('name phone'),
      Invoice.find({ invoiceNumber: regex }).limit(5).select('invoiceNumber grandTotal date'),
    ]);

    res.json({ products, customers, invoices });
  } catch (err) {
    next(err);
  }
};
