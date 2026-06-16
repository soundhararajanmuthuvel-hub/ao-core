const Product = require('../models/Product');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingRecipeMaterial = require('../models/ManufacturingRecipeMaterial');
const RawMaterial = require('../models/RawMaterial');
const RepackRecipe = require('../models/RepackRecipe');
const RepackRecipeMaterial = require('../models/RepackRecipeMaterial');

/**
 * Recalculates the purchase price of a specific product based on its manufacturing and repack recipes.
 * - If the product's supplier is "repack" (case-insensitive):
 *   purchasePrice = (bulkProduct.purchasePrice * bulkQty / finishedQty) + packingMaterialCosts (from ManufacturingRecipe where rawMaterial is packing material)
 * - Else (if own manufactured or has a manufacturing recipe):
 *   purchasePrice = Sum(recipeMaterial.qty * rawMaterial.purchasePrice) / yieldQty
 */
async function recalculateProductPrice(productId, transaction = null) {
  try {
    const product = await Product.findByPk(productId, { transaction });
    if (!product) return;

    const isRepack = product.supplier && product.supplier.toLowerCase().trim() === 'repack';

    if (isRepack) {
      // 1. Calculate repack cost from RepackRecipe
      let repackCost = 0;
      const repackRecipe = await RepackRecipe.findOne({
        where: { finishedProductId: productId, status: 'active' },
        include: [{
          model: RepackRecipeMaterial,
          as: 'materials',
          include: [{ model: Product, as: 'product' }]
        }],
        transaction
      });

      if (repackRecipe && Number(repackRecipe.finishedQty) > 0) {
        let totalBulkCost = 0;
        for (const mat of repackRecipe.materials) {
          totalBulkCost += Number(mat.qty || 0) * Number(mat.product?.purchasePrice || 0);
        }
        repackCost = totalBulkCost / Number(repackRecipe.finishedQty);
      }

      // 2. Calculate packing cost from ManufacturingRecipe (only packaging materials)
      let packingCost = 0;
      const mfgRecipe = await ManufacturingRecipe.findOne({
        where: { productId: productId, status: 'Active' },
        include: [{
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial' }]
        }],
        transaction
      });

      if (mfgRecipe && Number(mfgRecipe.yieldQty) > 0) {
        let totalPackingMaterialCost = 0;
        const packingCategories = ['Packaging Materials', 'Labels', 'Bottles', 'Pouches', 'Cartons', 'Other Materials'];
        for (const mat of mfgRecipe.materials) {
          if (mat.rawMaterial && packingCategories.includes(mat.rawMaterial.category)) {
            totalPackingMaterialCost += Number(mat.qty || 0) * Number(mat.rawMaterial.purchasePrice || 0);
          }
        }
        packingCost = totalPackingMaterialCost / Number(mfgRecipe.yieldQty);
      }

      const newPrice = Number((repackCost + packingCost).toFixed(2));
      if (Number(product.purchasePrice) !== newPrice) {
        product.purchasePrice = newPrice;
        await product.save({ transaction });
      }
    } else {
      // Own manufacturing (or regular product with recipe)
      const mfgRecipe = await ManufacturingRecipe.findOne({
        where: { productId: productId, status: 'Active' },
        include: [{
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial' }]
        }],
        transaction
      });

      if (mfgRecipe && Number(mfgRecipe.yieldQty) > 0) {
        let totalRawMaterialCost = 0;
        for (const mat of mfgRecipe.materials) {
          totalRawMaterialCost += Number(mat.qty || 0) * Number(mat.rawMaterial?.purchasePrice || 0);
        }
        const newPrice = Number((totalRawMaterialCost / Number(mfgRecipe.yieldQty)).toFixed(2));
        if (Number(product.purchasePrice) !== newPrice) {
          product.purchasePrice = newPrice;
          await product.save({ transaction });
        }
      }
    }
  } catch (err) {
    console.error(`Error recalculating product price for ID ${productId}:`, err);
  }
}

/**
 * Recalculates the purchase price of all products.
 */
async function recalculateAllProductPrices(transaction = null) {
  try {
    const products = await Product.findAll({ transaction });
    for (const p of products) {
      await recalculateProductPrice(p.id, transaction);
    }
  } catch (err) {
    console.error('Error recalculating all product prices:', err);
  }
}

module.exports = {
  recalculateProductPrice,
  recalculateAllProductPrices
};
