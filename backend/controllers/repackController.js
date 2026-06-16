const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const RepackRecipe = require('../models/RepackRecipe');
const RepackRecipeMaterial = require('../models/RepackRecipeMaterial');
const RepackEntry = require('../models/RepackEntry');
const RepackEntryMaterial = require('../models/RepackEntryMaterial');
const Product = require('../models/Product');
const User = require('../models/User');
const { updateStock } = require('../utils/stockService');
const { logActivity } = require('../utils/helpers');
const { recalculateProductPrice } = require('../utils/priceService');

/* =========================================================
   RECIPE CRUD
========================================================= */

// GET /api/repack/recipes
exports.getRecipes = async (req, res, next) => {
  try {
    const recipes = await RepackRecipe.findAll({
      include: [
        { model: Product, as: 'finishedProduct', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'sellingPrice'] },
        { 
          model: RepackRecipeMaterial, 
          as: 'materials', 
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'stock'] }] 
        }
      ],
      order: [['recipeName', 'ASC']]
    });
    res.json(recipes);
  } catch (err) {
    next(err);
  }
};

// GET /api/repack/recipes/:id
exports.getRecipe = async (req, res, next) => {
  try {
    const recipe = await RepackRecipe.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'finishedProduct', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'sellingPrice'] },
        { 
          model: RepackRecipeMaterial, 
          as: 'materials', 
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'stock'] }] 
        }
      ]
    });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    next(err);
  }
};

// POST /api/repack/recipes
exports.createRecipe = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { recipeName, finishedProductId, finishedQty, unit, wastagePercent, notes, materials } = req.body;
    
    const validMaterials = (materials || []).filter(mat => mat.productId && mat.productId !== '');

    if (!recipeName || !finishedProductId || !validMaterials.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Missing recipe details or materials' });
    }

    const recipe = await RepackRecipe.create({
      recipeName,
      finishedProductId,
      finishedQty: Number(finishedQty) || 1,
      unit: unit || 'pcs',
      wastagePercent: Number(wastagePercent) || 0,
      notes,
      status: 'active'
    }, { transaction: t });

    for (const mat of validMaterials) {
      await RepackRecipeMaterial.create({
        recipeId: recipe.id,
        productId: mat.productId,
        qty: Number(mat.qty)
      }, { transaction: t });
    }

    await t.commit();
    await logActivity(req.user.id, 'create', 'repack_recipe', `Created recipe ${recipeName}`);
    await recalculateProductPrice(finishedProductId);

    const populated = await RepackRecipe.findByPk(recipe.id, {
      include: [
        { model: Product, as: 'finishedProduct' },
        { model: RepackRecipeMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
      ]
    });
    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// PUT /api/repack/recipes/:id
exports.updateRecipe = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { recipeName, finishedProductId, finishedQty, unit, wastagePercent, notes, status, materials } = req.body;
    
    const recipe = await RepackRecipe.findByPk(req.params.id, { transaction: t });
    if (!recipe) {
      await t.rollback();
      return res.status(404).json({ message: 'Recipe not found' });
    }

    await recipe.update({
      recipeName: recipeName || recipe.recipeName,
      finishedProductId: finishedProductId || recipe.finishedProductId,
      finishedQty: finishedQty !== undefined ? Number(finishedQty) : recipe.finishedQty,
      unit: unit || recipe.unit,
      wastagePercent: wastagePercent !== undefined ? Number(wastagePercent) : recipe.wastagePercent,
      notes: notes !== undefined ? notes : recipe.notes,
      status: status || recipe.status
    }, { transaction: t });

    if (materials) {
      // Recreate materials for simplicity
      await RepackRecipeMaterial.destroy({ where: { recipeId: recipe.id }, transaction: t });
      const validMaterials = (materials || []).filter(mat => mat.productId && mat.productId !== '');
      for (const mat of validMaterials) {
        await RepackRecipeMaterial.create({
          recipeId: recipe.id,
          productId: mat.productId,
          qty: Number(mat.qty)
        }, { transaction: t });
      }
    }

    await t.commit();
    await logActivity(req.user.id, 'update', 'repack_recipe', `Updated recipe ${recipe.recipeName}`);
    await recalculateProductPrice(recipe.finishedProductId);

    const populated = await RepackRecipe.findByPk(recipe.id, {
      include: [
        { model: Product, as: 'finishedProduct' },
        { model: RepackRecipeMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
      ]
    });
    res.json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// DELETE /api/repack/recipes/:id
exports.deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await RepackRecipe.findByPk(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    
    await recipe.destroy();
    await logActivity(req.user.id, 'delete', 'repack_recipe', `Deleted recipe ${recipe.recipeName}`);
    res.json({ message: 'Recipe deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/* =========================================================
   REPACK ENTRIES CRUD
========================================================= */

// GET /api/repack
exports.getEntries = async (req, res, next) => {
  try {
    const ProductPackSize = require('../models/ProductPackSize');
    const entries = await RepackEntry.findAll({
      include: [
        { model: Product, as: 'finishedProduct', attributes: ['id', 'name', 'sku', 'unit'] },
        { model: RepackRecipe, as: 'recipe', attributes: ['id', 'recipeName'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: ProductPackSize, as: 'packSize', attributes: ['id', 'packName'] }
      ],
      order: [['date', 'DESC']]
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
};

// GET /api/repack/:id
exports.getEntry = async (req, res, next) => {
  try {
    const ProductPackSize = require('../models/ProductPackSize');
    const entry = await RepackEntry.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'finishedProduct' },
        { model: RepackRecipe, as: 'recipe' },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: ProductPackSize, as: 'packSize' },
        { 
          model: RepackEntryMaterial, 
          as: 'materials', 
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice'] }] 
        }
      ]
    });
    if (!entry) return res.status(404).json({ message: 'Repack entry not found' });
    res.json(entry);
  } catch (err) {
    next(err);
  }
};

// POST /api/repack
exports.createEntry = async (req, res, next) => {
  const isAllowedWrite = ['admin', 'Super Admin', 'Manufacturing Manager', 'production_manager'].includes(req.user.role);
  if (!isAllowedWrite) {
    return res.status(403).json({ message: 'Role is view-only.' });
  }

  const { recipeId, productId, packSizeId, qtyToProduce, laborCost = 0, packingMaterialCost = 0, otherCost = 0, notes, status = 'completed', date } = req.body;
  const lossQty = Number(req.body.lossQty || 0);

  const ProductPackSize = require('../models/ProductPackSize');
  const RawMaterial = require('../models/RawMaterial');
  const RawMaterialMovement = require('../models/RawMaterialMovement');

  // Direct bulk-to-pack repack
  if (packSizeId && productId) {
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const packSize = await ProductPackSize.findByPk(packSizeId);
    if (!packSize) return res.status(404).json({ message: 'Pack size not found' });

    const packQuantity = Number(qtyToProduce);
    const weightToConsume = (packQuantity * Number(packSize.weightInGrams)) / 1000;
    const totalBulkNeeded = weightToConsume + lossQty;

    // Find pouch and label in raw materials matching pack size name (e.g. "500g")
    const pouch = await RawMaterial.findOne({
      where: {
        category: { [Op.in]: ['Pouches', 'Packaging Materials'] },
        name: { [Op.like]: `%${packSize.packName}%` }
      }
    });

    const label = await RawMaterial.findOne({
      where: {
        category: { [Op.in]: ['Labels'] },
        name: { [Op.like]: `%${packSize.packName}%` }
      }
    });

    // Stock Validation
    if (status === 'completed') {
      if (Number(product.stock) < totalBulkNeeded) {
        return res.status(400).json({ 
          message: `Insufficient bulk stock for: ${product.name}. Required: ${totalBulkNeeded.toFixed(2)} Kg, Available: ${Number(product.stock).toFixed(2)} Kg` 
        });
      }
      if (pouch && Number(pouch.stock) < packQuantity) {
        return res.status(400).json({
          message: `Insufficient stock for packaging pouch: ${pouch.name}. Required: ${packQuantity}, Available: ${Number(pouch.stock).toFixed(2)}`
        });
      }
      if (label && Number(label.stock) < packQuantity) {
        return res.status(400).json({
          message: `Insufficient stock for packaging label: ${label.name}. Required: ${packQuantity}, Available: ${Number(label.stock).toFixed(2)}`
        });
      }
    }

    const t = await sequelize.transaction();
    try {
      const year = new Date().getFullYear();
      const count = await RepackEntry.count({ transaction: t });
      const repackNumber = `RP-${year}-${String(count + 1).padStart(5, '0')}`;

      // Calculate Costs
      const bulkCost = totalBulkNeeded * Number(product.purchasePrice || 0);
      const computedPackingCost = ((pouch ? Number(pouch.purchasePrice || 0) : 0) + (label ? Number(label.purchasePrice || 0) : 0)) * packQuantity;
      const totalCost = bulkCost + computedPackingCost + Number(laborCost) + Number(otherCost);
      const costPerUnit = packQuantity > 0 ? (totalCost / packQuantity) : 0;

      const entry = await RepackEntry.create({
        repackNumber,
        date: date || new Date(),
        recipeId: null,
        finishedProductId: productId,
        packSizeId,
        qtyToProduce: packQuantity,
        rawMaterialCost: bulkCost,
        packingMaterialCost: computedPackingCost,
        laborCost: Number(laborCost),
        otherCost: Number(otherCost),
        totalCost,
        costPerUnit,
        notes,
        status,
        lossQty,
        createdById: req.user.id
      }, { transaction: t });

      // Record consumed bulk product in RepackEntryMaterial
      await RepackEntryMaterial.create({
        repackEntryId: entry.id,
        productId: productId,
        qtyUsed: totalBulkNeeded,
        unitCost: product.purchasePrice,
        totalCost: bulkCost
      }, { transaction: t });

      if (status === 'completed') {
        // 1. Deduct bulk product
        await updateStock(productId, -totalBulkNeeded, {
          type: 'repack',
          batchNumber: repackNumber,
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });

        // 2. Add finished pack stock
        const dbPackSize = await ProductPackSize.findByPk(packSizeId, { transaction: t });
        dbPackSize.stock = Number(dbPackSize.stock || 0) + packQuantity;
        await dbPackSize.save({ transaction: t });

        // 3. Deduct pouch
        if (pouch) {
          await RawMaterial.decrement({ stock: packQuantity }, { where: { id: pouch.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: pouch.id,
            type: 'consumption',
            quantity: -packQuantity,
            price: pouch.purchasePrice,
            notes: `Repack run ${repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }

        // 4. Deduct label
        if (label) {
          await RawMaterial.decrement({ stock: packQuantity }, { where: { id: label.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: label.id,
            type: 'consumption',
            quantity: -packQuantity,
            price: label.purchasePrice,
            notes: `Repack run ${repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }
      }

      await t.commit();
      await logActivity(req.user.id, 'create', 'repack_entry', `Created repack entry ${repackNumber} for pack size ${packSize.packName}`);

      const populated = await RepackEntry.findByPk(entry.id, {
        include: [
          { model: Product, as: 'finishedProduct' },
          { model: User, as: 'createdBy', attributes: ['id', 'name'] },
          { model: ProductPackSize, as: 'packSize' },
          { model: RepackEntryMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
        ]
      });
      return res.status(201).json(populated);
    } catch (err) {
      await t.rollback();
      next(err);
    }
  }

  // Fallback to original recipe-based repack
  if (!recipeId || !qtyToProduce) {
    return res.status(400).json({ message: 'Recipe and quantity to produce are required' });
  }

  // Fetch recipe and materials
  const recipe = await RepackRecipe.findByPk(recipeId, {
    include: [{ model: RepackRecipeMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }]
  });
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

  // Calculate needed raw materials
  const materialsNeeded = recipe.materials.map(m => {
    const factor = Number(qtyToProduce) / Number(recipe.finishedQty);
    const needed = Number(m.qty) * factor;
    return {
      productId: m.productId,
      name: m.product.name,
      neededQty: needed,
      unitCost: Number(m.product.purchasePrice) || 0,
      stock: Number(m.product.stock)
    };
  });

  // Stock Validation (if marking completed immediately)
  if (status === 'completed') {
    for (const mat of materialsNeeded) {
      if (mat.stock < mat.neededQty) {
        return res.status(400).json({ 
          message: `Insufficient stock for raw material: ${mat.name}. Required: ${mat.neededQty.toFixed(2)}, Available: ${mat.stock.toFixed(2)}` 
        });
      }
    }
  }

  const t = await sequelize.transaction();
  try {
    // Generate Repack Number sequential RP-YYYY-XXXXX
    const year = new Date().getFullYear();
    const count = await RepackEntry.count({ transaction: t });
    const repackNumber = `RP-${year}-${String(count + 1).padStart(5, '0')}`;

    // Calculate Costs
    const rawMaterialCost = materialsNeeded.reduce((sum, m) => sum + (m.neededQty * m.unitCost), 0);
    const totalCost = rawMaterialCost + Number(packingMaterialCost) + Number(laborCost) + Number(otherCost);
    const costPerUnit = Number(qtyToProduce) > 0 ? (totalCost / Number(qtyToProduce)) : 0;

    // Create Repack Entry
    const entry = await RepackEntry.create({
      repackNumber,
      date: date || new Date(),
      recipeId,
      finishedProductId: recipe.finishedProductId,
      qtyToProduce: Number(qtyToProduce),
      rawMaterialCost,
      packingMaterialCost: Number(packingMaterialCost),
      laborCost: Number(laborCost),
      otherCost: Number(otherCost),
      totalCost,
      costPerUnit,
      notes,
      status,
      lossQty,
      createdById: req.user.id
    }, { transaction: t });

    // Create Entry Materials Snapshots
    for (const mat of materialsNeeded) {
      await RepackEntryMaterial.create({
        repackEntryId: entry.id,
        productId: mat.productId,
        qtyUsed: mat.neededQty,
        unitCost: mat.unitCost,
        totalCost: mat.neededQty * mat.unitCost
      }, { transaction: t });
    }

    // Adjust Stocks if completed
    if (status === 'completed') {
      // Deduct raw materials
      for (const mat of materialsNeeded) {
        await updateStock(mat.productId, -mat.neededQty, {
          type: 'repack',
          batchNumber: repackNumber,
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });
      }

      // Add finished product stock
      await updateStock(recipe.finishedProductId, Number(qtyToProduce), {
        type: 'repack',
        batchNumber: repackNumber,
        referenceId: entry.id,
        referenceModel: 'RepackEntry',
        userId: req.user.id,
        transaction: t
      });
    }

    await t.commit();
    await logActivity(req.user.id, 'create', 'repack_entry', `Created repack entry ${repackNumber}`);

    const populated = await RepackEntry.findByPk(entry.id, {
      include: [
        { model: Product, as: 'finishedProduct' },
        { model: RepackRecipe, as: 'recipe' },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: RepackEntryMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
      ]
    });

    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// PUT /api/repack/:id
exports.updateEntry = async (req, res, next) => {
  const isAllowedWrite = ['admin', 'Super Admin', 'Manufacturing Manager', 'production_manager'].includes(req.user.role);
  if (!isAllowedWrite) {
    return res.status(403).json({ message: 'Role is view-only.' });
  }

  const { status, qtyToProduce, lossQty, laborCost, otherCost, notes, date } = req.body;
  const entry = await RepackEntry.findByPk(req.params.id, {
    include: [
      { model: RepackEntryMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
    ]
  });

  if (!entry) return res.status(404).json({ message: 'Repack entry not found' });

  // If already reversed, we can't edit it
  if (entry.status === 'reversed') {
    return res.status(400).json({ message: 'Cannot edit reversed repack entries.' });
  }

  const ProductPackSize = require('../models/ProductPackSize');
  const RawMaterial = require('../models/RawMaterial');
  const RawMaterialMovement = require('../models/RawMaterialMovement');

  const t = await sequelize.transaction();
  try {
    // 1. If it was completed, reverse the old stock changes first (within transaction)
    if (entry.status === 'completed') {
      if (entry.packSizeId) {
        // Direct bulk-to-pack repack reversal
        const oldPackQty = Number(entry.qtyToProduce);
        const packSize = await ProductPackSize.findByPk(entry.packSizeId, { transaction: t });
        const oldWeightToConsume = packSize ? (oldPackQty * Number(packSize.weightInGrams)) / 1000 : 0;
        const oldLossQty = Number(entry.lossQty || 0);

        // Add back bulk product stock
        await updateStock(entry.finishedProductId, oldWeightToConsume + oldLossQty, {
          type: 'repack_reversal',
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });

        // Decrement ProductPackSize stock
        if (packSize) {
          packSize.stock = Number(packSize.stock || 0) - oldPackQty;
          await packSize.save({ transaction: t });
        }

        // Find and restore pouch & label
        if (packSize) {
          const pouch = await RawMaterial.findOne({
            where: {
              category: { [Op.in]: ['Pouches', 'Packaging Materials'] },
              name: { [Op.like]: `%${packSize.packName}%` }
            },
            transaction: t
          });
          if (pouch) {
            await RawMaterial.increment({ stock: oldPackQty }, { where: { id: pouch.id }, transaction: t });
            await RawMaterialMovement.create({
              rawMaterialId: pouch.id,
              type: 'adjustment',
              quantity: oldPackQty,
              price: pouch.purchasePrice,
              notes: `Repack edit adjustment for ${entry.repackNumber}`,
              referenceId: entry.id,
              referenceModel: 'RepackEntry',
              createdById: req.user.id,
            }, { transaction: t });
          }

          const label = await RawMaterial.findOne({
            where: {
              category: { [Op.in]: ['Labels'] },
              name: { [Op.like]: `%${packSize.packName}%` }
            },
            transaction: t
          });
          if (label) {
            await RawMaterial.increment({ stock: oldPackQty }, { where: { id: label.id }, transaction: t });
            await RawMaterialMovement.create({
              rawMaterialId: label.id,
              type: 'adjustment',
              quantity: oldPackQty,
              price: label.purchasePrice,
              notes: `Repack edit adjustment for ${entry.repackNumber}`,
              referenceId: entry.id,
              referenceModel: 'RepackEntry',
              createdById: req.user.id,
            }, { transaction: t });
          }
        }
      } else {
        // Recipe based completed repack reversal
        for (const mat of entry.materials) {
          await updateStock(mat.productId, Number(mat.qtyUsed), {
            type: 'repack_reversal',
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            userId: req.user.id,
            transaction: t
          });
        }
        await updateStock(entry.finishedProductId, -Number(entry.qtyToProduce), {
          type: 'repack_reversal',
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });
      }
    }

    // 2. Compute new values (fallbacks to existing fields if not in request body)
    const newStatus = status || entry.status;
    const newQtyToProduce = qtyToProduce !== undefined ? Number(qtyToProduce) : Number(entry.qtyToProduce);
    const newLossQty = lossQty !== undefined ? Number(lossQty) : Number(entry.lossQty || 0);
    const newLaborCost = laborCost !== undefined ? Number(laborCost) : Number(entry.laborCost || 0);
    const newOtherCost = otherCost !== undefined ? Number(otherCost) : Number(entry.otherCost || 0);
    const newNotes = notes !== undefined ? notes : entry.notes;
    const newDate = date || entry.date;

    if (entry.packSizeId) {
      const product = await Product.findByPk(entry.finishedProductId, { transaction: t });
      if (!product) throw new Error('Product not found');
      const packSize = await ProductPackSize.findByPk(entry.packSizeId, { transaction: t });
      if (!packSize) throw new Error('Pack size not found');

      const newWeightToConsume = (newQtyToProduce * Number(packSize.weightInGrams)) / 1000;
      const totalBulkNeeded = newWeightToConsume + newLossQty;

      // Find pouch and label in raw materials
      const pouch = await RawMaterial.findOne({
        where: {
          category: { [Op.in]: ['Pouches', 'Packaging Materials'] },
          name: { [Op.like]: `%${packSize.packName}%` }
        },
        transaction: t
      });

      const label = await RawMaterial.findOne({
        where: {
          category: { [Op.in]: ['Labels'] },
          name: { [Op.like]: `%${packSize.packName}%` }
        },
        transaction: t
      });

      // Stock validation for completed status
      if (newStatus === 'completed') {
        if (Number(product.stock) < totalBulkNeeded) {
          throw new Error(`Insufficient bulk stock for: ${product.name}. Required: ${totalBulkNeeded.toFixed(2)} Kg, Available: ${Number(product.stock).toFixed(2)} Kg`);
        }
        if (pouch && Number(pouch.stock) < newQtyToProduce) {
          throw new Error(`Insufficient stock for packaging pouch: ${pouch.name}. Required: ${newQtyToProduce}, Available: ${Number(pouch.stock).toFixed(2)}`);
        }
        if (label && Number(label.stock) < newQtyToProduce) {
          throw new Error(`Insufficient stock for packaging label: ${label.name}. Required: ${newQtyToProduce}, Available: ${Number(label.stock).toFixed(2)}`);
        }
      }

      // Calculate new costs
      const bulkCost = totalBulkNeeded * Number(product.purchasePrice || 0);
      const computedPackingCost = ((pouch ? Number(pouch.purchasePrice || 0) : 0) + (label ? Number(label.purchasePrice || 0) : 0)) * newQtyToProduce;
      const totalCost = bulkCost + computedPackingCost + newLaborCost + newOtherCost;
      const costPerUnit = newQtyToProduce > 0 ? (totalCost / newQtyToProduce) : 0;

      // Update entry details
      await entry.update({
        date: newDate,
        qtyToProduce: newQtyToProduce,
        lossQty: newLossQty,
        rawMaterialCost: bulkCost,
        packingMaterialCost: computedPackingCost,
        laborCost: newLaborCost,
        otherCost: newOtherCost,
        totalCost,
        costPerUnit,
        notes: newNotes,
        status: newStatus
      }, { transaction: t });

      // Recreate or update RepackEntryMaterial
      await RepackEntryMaterial.destroy({ where: { repackEntryId: entry.id }, transaction: t });
      await RepackEntryMaterial.create({
        repackEntryId: entry.id,
        productId: entry.finishedProductId,
        qtyUsed: totalBulkNeeded,
        unitCost: product.purchasePrice,
        totalCost: bulkCost
      }, { transaction: t });

      // Apply new stock deductions if completed
      if (newStatus === 'completed') {
        // Deduct bulk product
        await updateStock(entry.finishedProductId, -totalBulkNeeded, {
          type: 'repack',
          batchNumber: entry.repackNumber,
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });

        // Add finished pack stock
        packSize.stock = Number(packSize.stock || 0) + newQtyToProduce;
        await packSize.save({ transaction: t });

        // Deduct pouch
        if (pouch) {
          await RawMaterial.decrement({ stock: newQtyToProduce }, { where: { id: pouch.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: pouch.id,
            type: 'consumption',
            quantity: -newQtyToProduce,
            price: pouch.purchasePrice,
            notes: `Repack run edit ${entry.repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }

        // Deduct label
        if (label) {
          await RawMaterial.decrement({ stock: newQtyToProduce }, { where: { id: label.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: label.id,
            type: 'consumption',
            quantity: -newQtyToProduce,
            price: label.purchasePrice,
            notes: `Repack run edit ${entry.repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }
      }
    } else {
      // Recipe-based repack editing
      const recipe = await RepackRecipe.findByPk(entry.recipeId, {
        include: [{ model: RepackRecipeMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }],
        transaction: t
      });
      if (!recipe) throw new Error('Recipe not found');

      // Calculate needed raw materials
      const materialsNeeded = recipe.materials.map(m => {
        const factor = Number(newQtyToProduce) / Number(recipe.finishedQty);
        const needed = Number(m.qty) * factor;
        return {
          productId: m.productId,
          name: m.product.name,
          neededQty: needed,
          unitCost: Number(m.product.purchasePrice) || 0,
          stock: Number(m.product.stock)
        };
      });

      // Stock validation
      if (newStatus === 'completed') {
        for (const mat of materialsNeeded) {
          if (mat.stock < mat.neededQty) {
            throw new Error(`Insufficient stock for raw material: ${mat.name}. Required: ${mat.neededQty.toFixed(2)}, Available: ${mat.stock.toFixed(2)}`);
          }
        }
      }

      // Calculate costs
      const rawMaterialCost = materialsNeeded.reduce((sum, m) => sum + (m.neededQty * m.unitCost), 0);
      const totalCost = rawMaterialCost + Number(entry.packingMaterialCost) + newLaborCost + newOtherCost;
      const costPerUnit = newQtyToProduce > 0 ? (totalCost / newQtyToProduce) : 0;

      // Update repack entry
      await entry.update({
        date: newDate,
        qtyToProduce: newQtyToProduce,
        lossQty: newLossQty,
        rawMaterialCost,
        laborCost: newLaborCost,
        otherCost: newOtherCost,
        totalCost,
        costPerUnit,
        notes: newNotes,
        status: newStatus
      }, { transaction: t });

      // Recreate RepackEntryMaterial records
      await RepackEntryMaterial.destroy({ where: { repackEntryId: entry.id }, transaction: t });
      for (const mat of materialsNeeded) {
        await RepackEntryMaterial.create({
          repackEntryId: entry.id,
          productId: mat.productId,
          qtyUsed: mat.neededQty,
          unitCost: mat.unitCost,
          totalCost: mat.neededQty * mat.unitCost
        }, { transaction: t });
      }

      if (newStatus === 'completed') {
        // Deduct raw materials
        for (const mat of materialsNeeded) {
          await updateStock(mat.productId, -mat.neededQty, {
            type: 'repack',
            batchNumber: entry.repackNumber,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            userId: req.user.id,
            transaction: t
          });
        }

        // Add finished product stock
        await updateStock(entry.finishedProductId, newQtyToProduce, {
          type: 'repack',
          batchNumber: entry.repackNumber,
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });
      }
    }

    await t.commit();
    await logActivity(req.user.id, 'update', 'repack_entry', `Updated repack entry ${entry.repackNumber}`);

    const populated = await RepackEntry.findByPk(entry.id, {
      include: [
        { model: Product, as: 'finishedProduct' },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: ProductPackSize, as: 'packSize' },
        { model: RepackEntryMaterial, as: 'materials', include: [{ model: Product, as: 'product' }] }
      ]
    });
    return res.json(populated);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ message: err.message || 'Failed to update repack entry' });
  }
};

// DELETE /api/repack/:id (Delete pending or Reverse completed)
exports.deleteEntry = async (req, res, next) => {
  const isAllowedWrite = ['admin', 'Super Admin', 'Manufacturing Manager', 'production_manager'].includes(req.user.role);
  if (!isAllowedWrite) {
    return res.status(403).json({ message: 'Role is view-only.' });
  }

  const entry = await RepackEntry.findByPk(req.params.id, {
    include: [{ model: RepackEntryMaterial, as: 'materials' }]
  });

  if (!entry) return res.status(404).json({ message: 'Repack entry not found' });

  // If pending, just delete from database
  if (entry.status === 'pending') {
    await entry.destroy();
    await logActivity(req.user.id, 'delete', 'repack_entry', `Deleted pending repack entry ${entry.repackNumber}`);
    return res.json({ message: 'Pending repack entry deleted successfully' });
  }

  // If already reversed
  if (entry.status === 'reversed') {
    return res.status(400).json({ message: 'Repack entry is already reversed' });
  }

  // Production Manager cannot reverse completed entries, only Admin
  const isAdmin = ['admin', 'Super Admin'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ message: 'Only administrators can reverse completed repack entries.' });
  }

  const ProductPackSize = require('../models/ProductPackSize');
  const RawMaterial = require('../models/RawMaterial');
  const RawMaterialMovement = require('../models/RawMaterialMovement');

  const t = await sequelize.transaction();
  try {
    if (entry.packSizeId) {
      // Direct pack size repack reversal
      const packQuantity = Number(entry.qtyToProduce);
      const packSize = await ProductPackSize.findByPk(entry.packSizeId, { transaction: t });
      const weightToConsume = packSize ? (packQuantity * Number(packSize.weightInGrams)) / 1000 : 0;

      // 1. Add bulk product stock back (including lossQty)
      const bulkRestoreQty = weightToConsume + Number(entry.lossQty || 0);
      await updateStock(entry.finishedProductId, bulkRestoreQty, {
        type: 'repack_reversal',
        referenceId: entry.id,
        referenceModel: 'RepackEntry',
        userId: req.user.id,
        transaction: t
      });

      // 2. Decrement ProductPackSize stock
      if (packSize) {
        packSize.stock = Number(packSize.stock || 0) - packQuantity;
        await packSize.save({ transaction: t });
      }

      // 3. Find and restore pouch & label
      if (packSize) {
        const pouch = await RawMaterial.findOne({
          where: {
            category: { [Op.in]: ['Pouches', 'Packaging Materials'] },
            name: { [Op.like]: `%${packSize.packName}%` }
          },
          transaction: t
        });
        if (pouch) {
          await RawMaterial.increment({ stock: packQuantity }, { where: { id: pouch.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: pouch.id,
            type: 'adjustment',
            quantity: packQuantity,
            price: pouch.purchasePrice,
            notes: `Repack reversal ${entry.repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }

        const label = await RawMaterial.findOne({
          where: {
            category: { [Op.in]: ['Labels'] },
            name: { [Op.like]: `%${packSize.packName}%` }
          },
          transaction: t
        });
        if (label) {
          await RawMaterial.increment({ stock: packQuantity }, { where: { id: label.id }, transaction: t });
          await RawMaterialMovement.create({
            rawMaterialId: label.id,
            type: 'adjustment',
            quantity: packQuantity,
            price: label.purchasePrice,
            notes: `Repack reversal ${entry.repackNumber}`,
            referenceId: entry.id,
            referenceModel: 'RepackEntry',
            createdById: req.user.id,
          }, { transaction: t });
        }
      }
    } else {
      // Old recipe-based repack reversal
      // Add raw materials back
      for (const mat of entry.materials) {
        await updateStock(mat.productId, Number(mat.qtyUsed), {
          type: 'repack_reversal',
          referenceId: entry.id,
          referenceModel: 'RepackEntry',
          userId: req.user.id,
          transaction: t
        });
      }

      // Deduct finished goods stock
      await updateStock(entry.finishedProductId, -Number(entry.qtyToProduce), {
        type: 'repack_reversal',
        referenceId: entry.id,
        referenceModel: 'RepackEntry',
        userId: req.user.id,
        transaction: t
      });
    }

    await entry.update({ status: 'reversed' }, { transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'reverse', 'repack_entry', `Reversed repack entry ${entry.repackNumber}`);
    res.json({ message: 'Repack entry reversed successfully', entry });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/* =========================================================
   REPACK REPORTS & DASHBOARD
========================================================= */

// GET /api/repack/report
exports.getReport = async (req, res, next) => {
  try {
    const ProductPackSize = require('../models/ProductPackSize');
    const entries = await RepackEntry.findAll({
      include: [
        { model: Product, as: 'finishedProduct', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'sellingPrice'] },
        { model: RepackRecipe, as: 'recipe', attributes: ['id', 'recipeName'] },
        { model: ProductPackSize, as: 'packSize', attributes: ['id', 'packName'] },
        { model: RepackEntryMaterial, as: 'materials', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'purchasePrice'] }] }
      ],
      order: [['date', 'DESC']]
    });

    // 1. Dashboard metrics (filters completed entries only for consumption/production)
    const totalOrders = entries.filter(e => e.status === 'completed').length;
    const pendingOrders = entries.filter(e => e.status === 'pending').length;
    
    // Today's repacks
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaysRepacks = entries.filter(e => e.status === 'completed' && new Date(e.date) >= startOfToday).length;

    // Cost aggregations
    let rawMaterialConsumedVal = 0;
    let finishedGoodsProducedQty = 0;
    let repackTotalCost = 0;

    entries.forEach(e => {
      if (e.status === 'completed') {
        rawMaterialConsumedVal += Number(e.rawMaterialCost);
        finishedGoodsProducedQty += Number(e.qtyToProduce);
        repackTotalCost += Number(e.totalCost);
      }
    });

    // 2. Charts Calculations
    // Monthly Repack Activity (Last 6 Months)
    const monthlyActivity = {};
    const monthlyConsumption = {};
    const monthlyProduction = {};

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
      monthlyActivity[label] = 0;
      monthlyConsumption[label] = 0;
      monthlyProduction[label] = 0;
    }

    entries.forEach(e => {
      if (e.status === 'completed') {
        const date = new Date(e.date);
        const label = `${months[date.getMonth()]} ${date.getFullYear().toString().substr(-2)}`;
        if (monthlyActivity[label] !== undefined) {
          monthlyActivity[label] += 1;
          monthlyConsumption[label] += Number(e.rawMaterialCost);
          monthlyProduction[label] += Number(e.qtyToProduce);
        }
      }
    });

    const monthlyChart = Object.keys(monthlyActivity).map(label => ({
      month: label,
      count: monthlyActivity[label],
      consumption: Number(monthlyConsumption[label].toFixed(2)),
      production: Number(monthlyProduction[label].toFixed(2))
    }));

    // Material consumption split (top products used)
    const matConsumptionMap = {};
    entries.forEach(e => {
      if (e.status === 'completed' && e.materials) {
        e.materials.forEach(m => {
          const name = m.product ? m.product.name : 'Unknown Product';
          matConsumptionMap[name] = (matConsumptionMap[name] || 0) + Number(m.qtyUsed);
        });
      }
    });
    const materialConsumptionChart = Object.keys(matConsumptionMap).map(name => ({
      name,
      value: Number(matConsumptionMap[name].toFixed(2))
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    // Finished Product production split
    const finishedProductionMap = {};
    entries.forEach(e => {
      if (e.status === 'completed' && e.finishedProduct) {
        const name = e.finishedProduct.name;
        finishedProductionMap[name] = (finishedProductionMap[name] || 0) + Number(e.qtyToProduce);
      }
    });
    const finishedProductionChart = Object.keys(finishedProductionMap).map(name => ({
      name,
      value: Number(finishedProductionMap[name].toFixed(2))
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    // 3. Product Wise Summary
    const productWiseSummaryMap = {};
    entries.forEach(e => {
      if (e.status === 'completed' && e.finishedProduct) {
        const key = e.finishedProductId;
        if (!productWiseSummaryMap[key]) {
          productWiseSummaryMap[key] = {
            productName: e.finishedProduct.name,
            sku: e.finishedProduct.sku,
            unit: e.finishedProduct.unit,
            totalProduced: 0,
            totalCost: 0,
            avgCostPerUnit: 0,
            timesRepacked: 0
          };
        }
        productWiseSummaryMap[key].totalProduced += Number(e.qtyToProduce);
        productWiseSummaryMap[key].totalCost += Number(e.totalCost);
        productWiseSummaryMap[key].timesRepacked += 1;
      }
    });
    const productWiseRepackReport = Object.values(productWiseSummaryMap).map(p => {
      p.avgCostPerUnit = p.totalProduced > 0 ? Number((p.totalCost / p.totalProduced).toFixed(2)) : 0;
      p.totalCost = Number(p.totalCost.toFixed(2));
      p.totalProduced = Number(p.totalProduced.toFixed(2));
      return p;
    });

    // 4. Material Consumption Detail
    const matConsumptionReport = [];
    entries.forEach(e => {
      if (e.status === 'completed' && e.materials) {
        e.materials.forEach(m => {
          matConsumptionReport.push({
            date: e.date,
            repackNumber: e.repackNumber,
            recipeName: e.recipe ? e.recipe.recipeName : (e.packSize ? `Repack to ${e.packSize.packName}` : 'Custom Repack'),
            materialName: m.product ? m.product.name : 'Unknown Product',
            materialSku: m.product ? m.product.sku : 'N/A',
            qtyUsed: Number(m.qtyUsed),
            unitCost: Number(m.unitCost),
            totalCost: Number(m.totalCost)
          });
        });
      }
    });

    // 5. Cost Analysis Detailed
    const costAnalysisReport = entries.map(e => ({
      repackNumber: e.repackNumber,
      date: e.date,
      recipeName: e.recipe ? e.recipe.recipeName : (e.packSize ? `Repack to ${e.packSize.packName}` : 'Custom Repack'),
      productName: e.finishedProduct ? e.finishedProduct.name : 'N/A',
      qtyProduced: Number(e.qtyToProduce),
      rawMaterialCost: Number(e.rawMaterialCost),
      packingMaterialCost: Number(e.packingMaterialCost),
      laborCost: Number(e.laborCost),
      otherCost: Number(e.otherCost),
      totalCost: Number(e.totalCost),
      costPerUnit: Number(e.costPerUnit),
      status: e.status
    }));

    res.json({
      metrics: {
        totalOrders,
        todaysRepacks,
        rawMaterialConsumedVal: Number(rawMaterialConsumedVal.toFixed(2)),
        finishedGoodsProducedQty: Number(finishedGoodsProducedQty.toFixed(2)),
        repackTotalCost: Number(repackTotalCost.toFixed(2)),
        pendingOrders
      },
      charts: {
        monthlyChart,
        materialConsumptionChart,
        finishedProductionChart
      },
      reports: {
        productWiseRepackReport,
        matConsumptionReport,
        costAnalysisReport
      }
    });
  } catch (err) {
    next(err);
  }
};
