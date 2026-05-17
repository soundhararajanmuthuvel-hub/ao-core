const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { createNotification, getSettings } = require('./helpers');

const recordMovement = async ({ productId, type, quantity, referenceId, referenceModel, notes, supplier, userId }) => {
  return StockMovement.create({
    product: productId,
    type,
    quantity,
    referenceId,
    referenceModel,
    notes,
    supplier,
    createdBy: userId,
  });
};

const updateStock = async (productId, delta, opts = {}) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');
  const newStock = product.stock + delta;
  if (newStock < 0) throw new Error(`Insufficient stock for ${product.name}`);
  product.stock = newStock;
  await product.save();

  await recordMovement({
    productId,
    type: opts.type || 'adjustment',
    quantity: delta,
    referenceId: opts.referenceId,
    referenceModel: opts.referenceModel,
    notes: opts.notes,
    supplier: opts.supplier,
    userId: opts.userId,
  });

  const settings = await getSettings();
  const threshold = product.lowStockThreshold ?? settings.lowStockThreshold;
  if (product.stock <= threshold) {
    await createNotification({
      title: 'Low Stock Alert',
      message: `${product.name} (${product.sku}) has only ${product.stock} ${product.unit} left`,
      type: 'warning',
      link: '/products',
    });
  }

  return product;
};

module.exports = { updateStock, recordMovement };
