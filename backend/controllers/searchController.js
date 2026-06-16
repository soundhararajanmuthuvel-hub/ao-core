const { Op } = require('sequelize');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

exports.globalSearch = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) return res.json({ products: [], customers: [], invoices: [] });

    const [products, customers, invoices] = await Promise.all([
      Product.findAll({
        where: {
          isArchived: { [Op.ne]: true },
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { sku: { [Op.like]: `%${q}%` } },
          ],
        },
        attributes: ['id', 'name', 'sku', 'stock'],
        limit: 5,
      }),
      Customer.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { phone: { [Op.like]: `%${q}%` } },
            { email: { [Op.like]: `%${q}%` } },
          ],
        },
        attributes: ['id', 'name', 'phone'],
        limit: 5,
      }),
      Invoice.findAll({
        where: {
          invoiceNumber: { [Op.like]: `%${q}%` },
        },
        attributes: ['id', 'invoiceNumber', 'grandTotal', 'date'],
        limit: 5,
      }),
    ]);

    res.json({ products, customers, invoices });
  } catch (err) {
    next(err);
  }
};
