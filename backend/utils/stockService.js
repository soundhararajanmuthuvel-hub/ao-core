const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { createNotification, getSettings } = require('./helpers');

const recordMovement = async ({ productId, type, quantity, referenceId, referenceModel, notes, supplier, userId, batchNumber, expiryDate }, queryOpts = {}) => {
  return StockMovement.create({
    productId,
    type,
    quantity,
    referenceId,
    referenceModel,
    notes,
    supplierId: supplier || null,
    createdById: userId || null,
    batchNumber: batchNumber || null,
    expiryDate: expiryDate || null,
  }, queryOpts);
};

const updateStock = async (productId, delta, opts = {}) => {
  const transaction = opts.transaction;
  const queryOpts = transaction ? { transaction } : {};
  
  if (!productId) {
    console.warn('updateStock: No productId provided. Skipping.');
    return null;
  }
  
  const product = await Product.findByPk(productId, queryOpts);
  if (!product) {
    console.warn(`updateStock: Product with ID ${productId} not found. Skipping.`);
    return null;
  }
  const newStock = Number(product.stock) + delta;
  if (newStock < 0) throw new Error(`Insufficient stock for ${product.name}`);
  product.stock = newStock;
  await product.save(queryOpts);

  if (delta < 0 && !opts.batchNumber) {
    let qtyToDeduct = Math.abs(delta);
    
    // Find active batches with positive remaining stock
    const activeBatches = await StockMovement.sequelize.query(
      `SELECT batchNumber, expiryDate, SUM(quantity) AS remaining
       FROM StockMovements
       WHERE productId = :productId AND batchNumber IS NOT NULL AND batchNumber != ''
       GROUP BY batchNumber, expiryDate
       HAVING remaining > 0
       ORDER BY COALESCE(expiryDate, '9999-12-31') ASC, id ASC`,
      {
        replacements: { productId },
        type: StockMovement.sequelize.QueryTypes.SELECT,
        ...queryOpts
      }
    );

    for (const batch of activeBatches) {
      if (qtyToDeduct <= 0) break;
      const deductFromThisBatch = Math.min(qtyToDeduct, Number(batch.remaining));
      if (deductFromThisBatch > 0) {
        await recordMovement({
          productId,
          type: opts.type || 'adjustment',
          quantity: -deductFromThisBatch,
          referenceId: opts.referenceId,
          referenceModel: opts.referenceModel,
          notes: opts.notes ? `${opts.notes} | Batch: ${batch.batchNumber}` : `Auto Batch: ${batch.batchNumber}`,
          supplier: opts.supplier,
          userId: opts.userId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
        }, queryOpts);
        qtyToDeduct -= deductFromThisBatch;
      }
    }

    if (qtyToDeduct > 0) {
      // Deduct the rest with null batch
      await recordMovement({
        productId,
        type: opts.type || 'adjustment',
        quantity: -qtyToDeduct,
        referenceId: opts.referenceId,
        referenceModel: opts.referenceModel,
        notes: opts.notes,
        supplier: opts.supplier,
        userId: opts.userId,
        batchNumber: null,
        expiryDate: null,
      }, queryOpts);
    }
  } else {
    await recordMovement({
      productId,
      type: opts.type || 'adjustment',
      quantity: delta,
      referenceId: opts.referenceId,
      referenceModel: opts.referenceModel,
      notes: opts.notes,
      supplier: opts.supplier,
      userId: opts.userId,
      batchNumber: opts.batchNumber,
      expiryDate: opts.expiryDate,
    }, queryOpts);
  }

  const settings = await getSettings(queryOpts);
  const threshold = product.lowStockThreshold !== undefined ? Number(product.lowStockThreshold) : Number(settings.lowStockThreshold);
  if (Number(product.stock) <= threshold) {
    await createNotification({
      title: 'Low Stock Alert',
      message: `${product.name} (${product.sku}) has only ${product.stock} ${product.unit} left`,
      type: 'warning',
      link: '/products',
    }, queryOpts);
  }

  // Asynchronous WooCommerce Stock Sync if enabled
  if (settings.wooConnected && settings.wooSyncStockERPToWoo !== false && settings.wooInventorySyncMode !== 'Website Master' && (product.woocommerce_product_id || product.wooProductId)) {
    const skuToSync = product.sku;
    const stockToSync = product.stock;
    (async () => {
      try {
        const WooCommerceService = require('./wooService');
        const woo = new WooCommerceService(settings);
        await woo.updateStockOnWoo(skuToSync, stockToSync);
        console.log(`[WooCommerce Stock Sync] Synced ${skuToSync} stock to WooCommerce (${stockToSync}).`);
      } catch (err) {
        console.error(`[WooCommerce Stock Sync] Failed to sync ${skuToSync}:`, err.message);
      }
    })();
  }

  return product;
};

module.exports = { updateStock, recordMovement };
