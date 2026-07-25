const { Op } = require('sequelize');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const ReturnRequest = require('../models/ReturnRequest');
const RepackWorkOrder = require('../models/RepackWorkOrder');
const ReturnCreditNote = require('../models/ReturnCreditNote');

exports.globalSearch = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) return res.json({ products: [], customers: [], invoices: [], returns: [], repackOrders: [], creditNotes: [] });

    const [products, customers, invoices, returns, repackOrders, creditNotes] = await Promise.all([
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
      ReturnRequest.findAll({
        where: {
          [Op.or]: [
            { rmaNumber: { [Op.like]: `%${q}%` } },
            { returnReason: { [Op.like]: `%${q}%` } },
            { customerType: { [Op.like]: `%${q}%` } },
          ]
        },
        attributes: ['id', 'rmaNumber', 'status', 'totalValue', 'returnReason'],
        limit: 5
      }),
      RepackWorkOrder.findAll({
        where: {
          [Op.or]: [
            { workOrderNumber: { [Op.like]: `%${q}%` } },
            { batchNumber: { [Op.like]: `%${q}%` } },
          ]
        },
        attributes: ['id', 'workOrderNumber', 'batchNumber', 'quantity', 'status'],
        limit: 5
      }),
      ReturnCreditNote.findAll({
        where: {
          creditNoteNumber: { [Op.like]: `%${q}%` }
        },
        attributes: ['id', 'creditNoteNumber', 'totalAmount', 'status'],
        limit: 5
      })
    ]);

    res.json({ products, customers, invoices, returns, repackOrders, creditNotes });
  } catch (err) {
    next(err);
  }
};

