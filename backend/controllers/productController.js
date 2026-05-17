const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { logActivity } = require('../utils/helpers');

exports.getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const query = {};
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') },
        { barcode: new RegExp(search, 'i') },
      ];
    }
    if (category) query.category = category;
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getLowStock = async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    }).sort({ stock: 1 });
    res.json({ products, count: products.length });
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category');
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

exports.getStockHistory = async (req, res, next) => {
  try {
    const movements = await StockMovement.find({ product: req.params.id })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ movements });
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/products/${req.file.filename}`;
    const product = await Product.create(data);
    await logActivity(req.user._id, 'create', 'products', `Created product ${product.name}`);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/products/${req.file.filename}`;
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await logActivity(req.user._id, 'update', 'products', `Updated product ${product.name}`);
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await logActivity(req.user._id, 'delete', 'products', `Deleted product ${product.name}`);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};
