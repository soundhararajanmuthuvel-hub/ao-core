const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const { getNextPurchaseNumber, logActivity } = require('../utils/helpers');
const { updateStock } = require('../utils/stockService');

exports.getPurchases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const total = await Purchase.countDocuments();
    const purchases = await Purchase.find()
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ purchases, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const { supplier, items, date } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Items required' });

    const enrichedItems = [];
    let total = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: `Product not found` });
      const lineTotal = item.qty * item.unitPrice;
      total += lineTotal;
      enrichedItems.push({
        product: product._id,
        name: product.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal,
      });
    }

    const purchaseNumber = await getNextPurchaseNumber();
    const purchase = await Purchase.create({
      purchaseNumber,
      supplier,
      items: enrichedItems,
      total,
      date: date || new Date(),
      createdBy: req.user._id,
    });

    for (const item of enrichedItems) {
      await updateStock(item.product, item.qty, {
        type: 'purchase',
        referenceId: purchase._id,
        referenceModel: 'Purchase',
        userId: req.user._id,
      });
      await Product.findByIdAndUpdate(item.product, { purchasePrice: item.unitPrice });
    }

    await logActivity(req.user._id, 'create', 'purchases', `Created purchase ${purchaseNumber}`);
    res.status(201).json({ purchase });
  } catch (err) {
    next(err);
  }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    for (const item of purchase.items) {
      await updateStock(item.product, -item.qty, {
        type: 'adjustment',
        referenceId: purchase._id,
        referenceModel: 'Purchase',
        notes: 'Purchase deleted',
        userId: req.user._id,
      });
    }
    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted' });
  } catch (err) {
    next(err);
  }
};
