const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Supplier = require('../models/Supplier');
const { updateStock } = require('../utils/stockService');
const { logActivity } = require('../utils/helpers');

const movementOpts = async (body, userId) => {
  const { supplierId, notes } = body;
  let noteText = notes || '';
  let supplier = supplierId || undefined;
  if (supplierId) {
    const s = await Supplier.findById(supplierId);
    if (s) noteText = noteText ? `${noteText} | Supplier: ${s.name}` : `Supplier: ${s.name}`;
  }
  return { notes: noteText, supplier, userId };
};

exports.getMovements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const query = {};
    if (req.query.product) query.product = req.query.product;
    if (req.query.type) query.type = req.query.type;
    const total = await StockMovement.countDocuments(query);
    const movements = await StockMovement.find(query)
      .populate('product', 'name sku')
      .populate('supplier', 'name phone type')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ movements, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const opts = await movementOpts(req.body, req.user._id);
    const product = await updateStock(productId, quantity, {
      type: 'adjustment',
      ...opts,
    });
    await logActivity(req.user._id, 'adjust', 'inventory', `Adjusted stock for ${product.name}`);
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

exports.repack = async (req, res, next) => {
  try {
    const { fromProductId, toProductId, fromQty, toQty } = req.body;
    const opts = await movementOpts(req.body, req.user._id);
    await updateStock(fromProductId, -fromQty, { type: 'repack', ...opts });
    await updateStock(toProductId, toQty, { type: 'repack', ...opts });
    await logActivity(req.user._id, 'repack', 'inventory', `Repack: ${fromQty} → ${toQty}`);
    res.json({ message: 'Repack successful' });
  } catch (err) {
    next(err);
  }
};

exports.manufacturing = async (req, res, next) => {
  try {
    const { inputs, outputs } = req.body;
    const opts = await movementOpts(req.body, req.user._id);
    for (const input of inputs) {
      await updateStock(input.productId, -input.qty, { type: 'manufacturing', ...opts });
    }
    for (const output of outputs) {
      await updateStock(output.productId, output.qty, { type: 'manufacturing', ...opts });
    }
    await logActivity(req.user._id, 'manufacturing', 'inventory', 'Manufacturing completed');
    res.json({ message: 'Manufacturing successful' });
  } catch (err) {
    next(err);
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    const totalValue = products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);
    const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold);
    res.json({ products, totalValue, lowStockCount: lowStock.length, lowStock });
  } catch (err) {
    next(err);
  }
};
