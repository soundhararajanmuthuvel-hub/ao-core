const Purchase = require('../models/Purchase');
const Product = require('../models/Product');

const {
  getNextPurchaseNumber,
  logActivity,
} = require('../utils/helpers');

const { updateStock } = require('../utils/stockService');

/* =========================================
   GET ALL PURCHASES
========================================= */
exports.getPurchases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const total = await Purchase.countDocuments();

    const purchases = await Purchase.find()
      .populate('createdBy', 'name email')
      .populate('supplier', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      purchases,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   GET SINGLE PURCHASE
========================================= */
exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('supplier', 'name')
      .populate('items.product', 'name sku');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   CREATE PURCHASE
========================================= */
exports.createPurchase = async (req, res, next) => {
  try {
    const { supplier, items, date, notes } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Purchase items are required',
      });
    }

    let total = 0;

    const enrichedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      const qty = Number(item.qty);
      const unitPrice = Number(item.unitPrice);

      const lineTotal = qty * unitPrice;

      total += lineTotal;

      enrichedItems.push({
        product: product._id,
        name: product.name,
        qty,
        unitPrice,
        lineTotal,
      });
    }

    const purchaseNumber = await getNextPurchaseNumber();

    const purchase = await Purchase.create({
      purchaseNumber,
      supplier,
      items: enrichedItems,
      total,
      notes,
      date: date || new Date(),
      createdBy: req.user._id,
    });

    // Update stock
    for (const item of enrichedItems) {
      await updateStock(item.product, item.qty, {
        type: 'purchase',
        referenceId: purchase._id,
        referenceModel: 'Purchase',
        userId: req.user._id,
      });

      await Product.findByIdAndUpdate(item.product, {
        purchasePrice: item.unitPrice,
      });
    }

    await logActivity(
      req.user._id,
      'create',
      'purchases',
      `Created purchase ${purchase.purchaseNumber}`
    );

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      purchase,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   UPDATE PURCHASE
========================================= */
exports.updatePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    await logActivity(
      req.user._id,
      'update',
      'purchases',
      `Updated purchase ${purchase.purchaseNumber}`
    );

    res.status(200).json({
      success: true,
      message: 'Purchase updated successfully',
      purchase: updatedPurchase,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   DELETE PURCHASE
========================================= */
exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    // Reverse stock
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

    await logActivity(
      req.user._id,
      'delete',
      'purchases',
      `Deleted purchase ${purchase.purchaseNumber}`
    );

    res.status(200).json({
      success: true,
      message: 'Purchase deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};