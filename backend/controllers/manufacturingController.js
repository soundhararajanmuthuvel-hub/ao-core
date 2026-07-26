const { sequelize } = require('../config/db');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const RawMaterialMovement = require('../models/RawMaterialMovement');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingRecipeMaterial = require('../models/ManufacturingRecipeMaterial');
const ManufacturingEntry = require('../models/ManufacturingEntry');
const ManufacturingEntryMaterial = require('../models/ManufacturingEntryMaterial');
const User = require('../models/User');
const { updateStock } = require('../utils/stockService');
const { logActivity } = require('../utils/helpers');
const { recalculateProductPrice } = require('../utils/priceService');

// --- RECIPES CRUD ---

exports.getRecipes = async (req, res, next) => {
  try {
    const recipes = await ManufacturingRecipe.findAll({
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'sellingPrice'] },
        { model: Product, as: 'variantProduct', attributes: ['id', 'name', 'sku', 'unit', 'purchasePrice', 'sellingPrice', 'conversionFactor', 'wholesalePrice', 'gstPercent', 'mrp'] },
        {
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit', 'purchasePrice', 'stock'] }],
        },
      ],
      order: [['name', 'ASC']],
    });
    res.json(recipes);
  } catch (err) {
    next(err);
  }
};

exports.createRecipe = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { name, productId, yieldQty = 1.00, notes, materials, variantProductId, packSize, yieldPacks, packWeight, wastagePercent } = req.body;
    
    // Filter out materials that have empty/missing rawMaterialId
    const validMaterials = (materials || []).filter(mat => mat.rawMaterialId && mat.rawMaterialId !== '');

    if (!name || !productId || !validMaterials.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Name, finished product, and at least one valid raw material are required.' });
    }

    // Auto-calculate yieldQty in KG for variant recipes
    let calculatedYieldQty = Number(yieldQty);
    if (variantProductId && yieldPacks && packWeight) {
      calculatedYieldQty = Number(yieldPacks) * Number(packWeight);
    }

    const recipe = await ManufacturingRecipe.create({
      name,
      productId,
      yieldQty: calculatedYieldQty,
      notes,
      status: 'Active',
      variantProductId: variantProductId || null,
      packSize: packSize || null,
      yieldPacks: yieldPacks || null,
      packWeight: packWeight || null,
      wastagePercent: wastagePercent || 0.00,
    }, { transaction: t });

    for (const mat of validMaterials) {
      await ManufacturingRecipeMaterial.create({
        recipeId: recipe.id,
        rawMaterialId: mat.rawMaterialId,
        qty: mat.qty,
      }, { transaction: t });
    }

    await t.commit();
    await logActivity(req.user.id, 'create_recipe', 'inventory', `Created manufacturing recipe ${name}`);
    await recalculateProductPrice(productId);
    
    const populated = await ManufacturingRecipe.findByPk(recipe.id, {
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku'] },
        { model: Product, as: 'variantProduct', attributes: ['id', 'name', 'sku'] },
        {
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'unit'] }],
        },
      ],
    });

    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.updateRecipe = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const recipe = await ManufacturingRecipe.findByPk(req.params.id, { transaction: t });
    if (!recipe) {
      await t.rollback();
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const { name, productId, yieldQty, notes, status, materials, variantProductId, packSize, yieldPacks, packWeight, wastagePercent } = req.body;
    
    // Auto-calculate yieldQty in KG for variant recipes
    let calculatedYieldQty = Number(yieldQty);
    if (variantProductId && yieldPacks && packWeight) {
      calculatedYieldQty = Number(yieldPacks) * Number(packWeight);
    }

    await recipe.update({
      name,
      productId,
      yieldQty: calculatedYieldQty,
      notes,
      status,
      variantProductId: variantProductId || null,
      packSize: packSize || null,
      yieldPacks: yieldPacks || null,
      packWeight: packWeight || null,
      wastagePercent: wastagePercent || 0.00,
    }, { transaction: t });

    if (materials) {
      // Re-create ingredients mapping
      await ManufacturingRecipeMaterial.destroy({ where: { recipeId: recipe.id }, transaction: t });
      const validMaterials = (materials || []).filter(mat => mat.rawMaterialId && mat.rawMaterialId !== '');
      for (const mat of validMaterials) {
        await ManufacturingRecipeMaterial.create({
          recipeId: recipe.id,
          rawMaterialId: mat.rawMaterialId,
          qty: mat.qty,
        }, { transaction: t });
      }
    }

    await t.commit();
    await logActivity(req.user.id, 'update_recipe', 'inventory', `Updated manufacturing recipe ${recipe.name}`);
    await recalculateProductPrice(recipe.productId);

    const populated = await ManufacturingRecipe.findByPk(recipe.id, {
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku'] },
        { model: Product, as: 'variantProduct', attributes: ['id', 'name', 'sku'] },
        {
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'unit'] }],
        },
      ],
    });
    res.json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await ManufacturingRecipe.findByPk(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    await recipe.destroy();
    await logActivity(req.user.id, 'delete_recipe', 'inventory', `Deleted manufacturing recipe ${recipe.name}`);
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    next(err);
  }
};

// --- PRODUCTION OPERATIONS ---

exports.getEntries = async (req, res, next) => {
  try {
    const ProductPackSize = require('../models/ProductPackSize');
    const entries = await ManufacturingEntry.findAll({
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku', 'unit'] },
        { model: ManufacturingRecipe, as: 'recipe', attributes: ['name'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
        { model: ProductPackSize, as: 'packSize', attributes: ['id', 'packName', 'weightInGrams'] },
        {
          model: ManufacturingEntryMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] }],
        },
      ],
      order: [['date', 'DESC']],
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
};

// Create and execute a manufacturing run
exports.createEntry = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { recipeId, productId, qtyToProduce, laborCost = 0, otherCost = 0, notes, status = 'completed', productionMode = 'weight', packSizeId } = req.body;
    if (!productId || !qtyToProduce || qtyToProduce <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Finished product and positive quantity are required.' });
    }

    const ProductPackSize = require('../models/ProductPackSize');
    const targetQty = Number(qtyToProduce);

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: 'Finished product not found.' });
    }

    let packSize = null;
    let totalOutputWeight = targetQty; // Default weight mode output in Kg

    if (productionMode === 'pack') {
      if (packSizeId) {
        // Legacy ProductPackSize path
        packSize = await ProductPackSize.findByPk(packSizeId, { transaction: t });
        if (!packSize) {
          await t.rollback();
          return res.status(404).json({ message: 'Pack size not found.' });
        }
        totalOutputWeight = (Number(packSize.weightInGrams) * targetQty) / 1000;
      } else if (product.parentProductId) {
        // New Product Variant path: conversionFactor represents pack weight in KG
        totalOutputWeight = Number(product.conversionFactor || 1.0) * targetQty;
      } else {
        await t.rollback();
        return res.status(400).json({ message: 'Pack size must be selected in Pack Count mode.' });
      }
    }
    
    // Resolve materials from the recipe
    let materialsToConsume = [];
    if (recipeId) {
      const recipe = await ManufacturingRecipe.findByPk(recipeId, {
        include: [{ model: ManufacturingRecipeMaterial, as: 'materials', include: [{ model: RawMaterial, as: 'rawMaterial' }] }],
        transaction: t
      });
      if (!recipe) {
        await t.rollback();
        return res.status(404).json({ message: 'Manufacturing recipe not found.' });
      }
      
      const wastageMultiplier = 1 + (Number(recipe.wastagePercent || 0) / 100);
      const ingredientMultiplier = (totalOutputWeight / Number(recipe.yieldQty || 1)) * wastageMultiplier;
      const weightMultiplier = (targetQty / Number(recipe.yieldQty || 1)) * wastageMultiplier;

      for (const item of recipe.materials) {
        let qtyNeeded;
        if (productionMode === 'pack') {
          const isPackaging = ['Packaging Materials', 'Labels', 'Pouches', 'Cartons', 'Bottles'].includes(item.rawMaterial.category);
          qtyNeeded = isPackaging ? targetQty : (Number(item.qty) * ingredientMultiplier);
        } else {
          qtyNeeded = Number(item.qty) * weightMultiplier;
        }

        materialsToConsume.push({
          rawMaterialId: item.rawMaterialId,
          qtyNeeded,
          name: item.rawMaterial.name,
          category: item.rawMaterial.category,
          unitCost: await calculateFifoCost(item.rawMaterialId, qtyNeeded, t),
          stockAvailable: Number(item.rawMaterial.stock || 0)
        });
      }
    } else {
      // Manual recipe-less run, materials sent directly in body
      const rawInputs = req.body.materials || [];
      for (const item of rawInputs) {
        const material = await RawMaterial.findByPk(item.rawMaterialId, { transaction: t });
        if (!material) throw new Error(`Raw material not found: ${item.rawMaterialId}`);
        materialsToConsume.push({
          rawMaterialId: item.rawMaterialId,
          qtyNeeded: Number(item.qty),
          name: material.name,
          category: material.category,
          unitCost: await calculateFifoCost(item.rawMaterialId, Number(item.qty), t),
          stockAvailable: Number(material.stock || 0)
        });
      }
    }

    // Auto-packaging lookup
    const match = product.name.match(/(\d+\s*(?:g|kg|ml|litre|pcs|box|carton|l))/i);
    const packName = match ? match[1].replace(/\s+/g, '').toLowerCase() : null;
    if (packName) {
      const { Op } = require('sequelize');
      const RawMaterial = require('../models/RawMaterial');
      const pouch = await RawMaterial.findOne({
        where: {
          category: { [Op.in]: ['Pouches', 'Packaging Materials'] },
          name: { [Op.like]: `%${packName}%` }
        },
        transaction: t
      });
      const label = await RawMaterial.findOne({
        where: {
          category: { [Op.in]: ['Labels'] },
          name: { [Op.like]: `%${packName}%` }
        },
        transaction: t
      });

      if (pouch && !materialsToConsume.some(m => m.rawMaterialId === pouch.id)) {
        materialsToConsume.push({
          rawMaterialId: pouch.id,
          qtyNeeded: targetQty,
          name: pouch.name,
          category: pouch.category,
          unitCost: Number(pouch.purchasePrice || 0),
          stockAvailable: Number(pouch.stock || 0)
        });
      }
      if (label && !materialsToConsume.some(m => m.rawMaterialId === label.id)) {
        materialsToConsume.push({
          rawMaterialId: label.id,
          qtyNeeded: targetQty,
          name: label.name,
          category: label.category,
          unitCost: Number(label.purchasePrice || 0),
          stockAvailable: Number(label.stock || 0)
        });
      }
    }

    // Cost calculations
    let rawMaterialCost = 0;
    let packagingCost = 0;
    for (const item of materialsToConsume) {
      // Validate stocks if completed
      if (status === 'completed' && item.qtyNeeded > item.stockAvailable) {
        await t.rollback();
        return res.status(400).json({
          message: `Insufficient stock for raw material "${item.name}". Required: ${item.qtyNeeded}, Available: ${item.stockAvailable}`
        });
      }
      const itemCost = item.qtyNeeded * item.unitCost;
      if (['Pouches', 'Packaging Materials', 'Labels', 'Bottles', 'Cartons'].includes(item.category)) {
        packagingCost += itemCost;
      } else {
        rawMaterialCost += itemCost;
      }
    }

    const overheadCost = Number(otherCost || 0);
    const totalCost = rawMaterialCost + packagingCost + Number(laborCost) + overheadCost;
    const costPerUnit = totalCost / targetQty;

    // Generate manufacturing order number
    const count = await ManufacturingEntry.count({ transaction: t });
    const mfgNumber = `MFG-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Auto-calculate batch format (MMM-YYYY) and 6 months expiry
    const entryDate = req.body.date ? new Date(req.body.date) : new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const calculatedBatchNumber = `${months[entryDate.getMonth()]}-${entryDate.getFullYear()}`;
    const calculatedExpiryDate = new Date(entryDate);
    calculatedExpiryDate.setMonth(calculatedExpiryDate.getMonth() + 6);

    const entry = await ManufacturingEntry.create({
      mfgNumber,
      date: entryDate,
      recipeId: recipeId || null,
      productId,
      qtyToProduce: targetQty,
      rawMaterialCost,
      packagingCost,
      laborCost: Number(laborCost),
      otherCost: overheadCost,
      overheadCost,
      totalCost,
      costPerUnit,
      notes,
      status,
      createdById: req.user.id,
      productionMode,
      packSizeId: productionMode === 'pack' ? packSizeId : null,
      batchNumber: calculatedBatchNumber,
      expiryDate: calculatedExpiryDate,
    }, { transaction: t });

    // Store snaps and adjust stocks
    for (const item of materialsToConsume) {
      await ManufacturingEntryMaterial.create({
        mfgEntryId: entry.id,
        rawMaterialId: item.rawMaterialId,
        qtyUsed: item.qtyNeeded,
        unitCost: item.unitCost,
        totalCost: item.qtyNeeded * item.unitCost,
      }, { transaction: t });

      if (status === 'completed') {
        // Deduct raw material stock
        await RawMaterial.decrement({ stock: item.qtyNeeded }, { where: { id: item.rawMaterialId }, transaction: t });
        // Log movement
        await RawMaterialMovement.create({
          rawMaterialId: item.rawMaterialId,
          type: 'consumption',
          quantity: -item.qtyNeeded,
          price: item.unitCost,
          notes: `Manufacture run ${mfgNumber}`,
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          createdById: req.user.id,
        }, { transaction: t });
      }
    }

    if (status === 'completed') {
      if (productionMode === 'pack') {
        if (packSize) {
          // Legacy ProductPackSize path
          packSize.stock = Number(packSize.stock || 0) + targetQty;
          await packSize.save({ transaction: t });

          // Update bulk stock using updateStock
          await updateStock(productId, totalOutputWeight, {
            type: 'manufacturing',
            referenceId: entry.id,
            referenceModel: 'ManufacturingEntry',
            userId: req.user.id,
            transaction: t,
            batchNumber: calculatedBatchNumber,
            expiryDate: calculatedExpiryDate,
          });
        } else {
          // New Product Variant path: increment variant product stock directly
          await updateStock(productId, targetQty, {
            type: 'manufacturing',
            referenceId: entry.id,
            referenceModel: 'ManufacturingEntry',
            userId: req.user.id,
            transaction: t,
            batchNumber: calculatedBatchNumber,
            expiryDate: calculatedExpiryDate,
          });
        }
      } else {
        // Update produced product stock
        await updateStock(productId, targetQty, {
          type: 'manufacturing',
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          userId: req.user.id,
          transaction: t,
          batchNumber: calculatedBatchNumber,
          expiryDate: calculatedExpiryDate,
        });
      }

      if (product) {
        product.purchasePrice = totalCost / totalOutputWeight; // update product cost per Kg
        await product.save({ transaction: t });
      }

      // GL Shadow Post
      try {
        const { postJournalEntry, getSystemAccount } = require('../services/ledgerService');
        const invFgAccountId = await getSystemAccount('Inventory_FG');
        const invRmAccountId = await getSystemAccount('Inventory_RM');

        const lines = [];
        // Debit FG Inventory for total cost of goods manufactured
        lines.push({ accountId: invFgAccountId, debit: totalCost, credit: 0, description: `Manufactured ${mfgNumber}` });
        // Credit RM Inventory for raw material cost
        lines.push({ accountId: invRmAccountId, debit: 0, credit: rawMaterialCost, description: `Consumed RM for ${mfgNumber}` });

        await postJournalEntry({
          entryDate,
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          referenceNumber: mfgNumber,
          description: 'Auto-posted Manufacturing Run',
          lines
        }, t);
      } catch (glError) {
        console.error('[GL SHADOW MODE] Failed to post mfg entry to ledger:', glError);
      }


      // Allocate finished stock to oldest Waiting For Stock invoices
      const { Op } = require('sequelize');
      const InvoiceItem = require('../models/InvoiceItem');
      const Invoice = require('../models/Invoice');
      const { autoCreateShipmentForInvoice } = require('./shippingController');

      const producedQty = productionMode === 'pack' ? totalOutputWeight : targetQty;

      const pendingItems = await InvoiceItem.findAll({
        where: {
          productId: productId,
          pendingQty: { [Op.gt]: 0 },
        },
        include: [
          {
            model: Invoice,
            as: 'invoice',
            where: { status: 'Waiting For Stock' },
          },
        ],
        order: [[{ model: Invoice, as: 'invoice' }, 'createdAt', 'ASC']],
        transaction: t,
      });

      let remainingToAllocate = producedQty;
      for (const item of pendingItems) {
        if (remainingToAllocate <= 0) break;

        const toAllocate = Math.min(remainingToAllocate, Number(item.pendingQty));
        if (toAllocate > 0) {
          item.dispatchedQty = Number(item.dispatchedQty || 0) + toAllocate;
          item.pendingQty = Number(item.pendingQty || 0) - toAllocate;
          await item.save({ transaction: t });

          remainingToAllocate -= toAllocate;

          // Deduct from stock since it is now dispatched
          await updateStock(item.productId, -toAllocate, {
            type: 'sale',
            referenceId: item.invoiceId,
            referenceModel: 'Invoice',
            userId: req.user.id,
            transaction: t,
          });

          // Check if invoice is now fully allocated
          const allInvoiceItems = await InvoiceItem.findAll({
            where: { invoiceId: item.invoiceId },
            transaction: t,
          });

          const isFullyAllocated = allInvoiceItems.every(i => Number(i.pendingQty) === 0);
          if (isFullyAllocated) {
            const inv = item.invoice;
            inv.status = 'Ready To Dispatch';
            await inv.save({ transaction: t });

            // Create shipment automatically
            await autoCreateShipmentForInvoice(item.invoiceId, t);
          }
        }
      }
    }

    await t.commit();
    await logActivity(req.user.id, 'create_mfg', 'inventory', `Executed manufacturing run ${mfgNumber}`);

    const populated = await ManufacturingEntry.findByPk(entry.id, {
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku', 'unit'] },
        { model: ManufacturingRecipe, as: 'recipe', attributes: ['name'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
        { model: ProductPackSize, as: 'packSize', attributes: ['id', 'packName'] },
        {
          model: ManufacturingEntryMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] }],
        },
      ],
    });

    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Reverse a completed production order
exports.reverseEntry = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const entry = await ManufacturingEntry.findByPk(req.params.id, {
      include: [{ model: ManufacturingEntryMaterial, as: 'materials', include: [{ model: RawMaterial, as: 'rawMaterial' }] }],
      transaction: t,
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ message: 'Manufacturing entry not found' });
    }

    if (entry.status !== 'completed') {
      await t.rollback();
      return res.status(400).json({ message: 'Only completed runs can be reversed.' });
    }

    const ProductPackSize = require('../models/ProductPackSize');

    // 1. Invert produced goods
    if (entry.productionMode === 'pack') {
      if (entry.packSizeId) {
        // Legacy ProductPackSize path
        const packSize = await ProductPackSize.findByPk(entry.packSizeId, { transaction: t });
        if (packSize) {
          packSize.stock = Number(packSize.stock || 0) - Number(entry.qtyToProduce);
          await packSize.save({ transaction: t });
        }
        const totalOutputWeight = (Number(packSize.weightInGrams) * Number(entry.qtyToProduce)) / 1000;
        await updateStock(entry.productId, -totalOutputWeight, {
          type: 'adjustment',
          notes: `Reversal of pack run ${entry.mfgNumber}`,
          userId: req.user.id,
          transaction: t,
        });
      } else {
        // New Product Variant path: decrement variant product stock directly
        await updateStock(entry.productId, -Number(entry.qtyToProduce), {
          type: 'adjustment',
          notes: `Reversal of pack run ${entry.mfgNumber}`,
          userId: req.user.id,
          transaction: t,
        });
      }
    } else {
      await updateStock(entry.productId, -Number(entry.qtyToProduce), {
        type: 'adjustment',
        notes: `Reversal of run ${entry.mfgNumber}`,
        userId: req.user.id,
        transaction: t,
      });
    }

    // 2. Return raw materials
    for (const item of entry.materials) {
      await RawMaterial.increment({ stock: Number(item.qtyUsed) }, { where: { id: item.rawMaterialId }, transaction: t });
      await RawMaterialMovement.create({
        rawMaterialId: item.rawMaterialId,
        type: 'adjustment',
        quantity: Number(item.qtyUsed),
        price: Number(item.unitCost),
        notes: `Restore raw: Reversal of ${entry.mfgNumber}`,
        referenceId: entry.id,
        referenceModel: 'ManufacturingEntry',
        createdById: req.user.id,
      }, { transaction: t });
    }

    entry.status = 'reversed';
    await entry.save({ transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'reverse_mfg', 'inventory', `Reversed manufacturing run ${entry.mfgNumber}`);
    
    res.json({ message: 'Manufacturing run successfully reversed.', entry });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getPlanner = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const Invoice = require('../models/Invoice');
    const InvoiceItem = require('../models/InvoiceItem');

    const pendingItems = await InvoiceItem.findAll({
      where: {
        pendingQty: { [Op.gt]: 0 },
      },
      include: [
        {
          model: Invoice,
          as: 'invoice',
          where: {
            status: 'Waiting For Stock',
          },
        },
        {
          model: Product,
          as: 'product',
        },
      ],
      order: [[{ model: Invoice, as: 'invoice' }, 'createdAt', 'ASC']],
    });

    const productMap = {};
    for (const item of pendingItems) {
      const prod = item.product;
      if (!prod) continue;
      if (!productMap[prod.id]) {
        productMap[prod.id] = {
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          pendingQty: 0,
          invoices: [],
        };
      }
      productMap[prod.id].pendingQty += Number(item.pendingQty);
      productMap[prod.id].invoices.push({
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoice.invoiceNumber,
        pendingQty: Number(item.pendingQty),
        expectedDispatchDate: item.invoice.expectedDispatchDate,
        commitment: item.invoice.commitment,
      });
    }

    const recipes = await ManufacturingRecipe.findAll({
      where: { status: 'Active' },
      include: [
        {
          model: ManufacturingRecipeMaterial,
          as: 'materials',
          include: [{ model: RawMaterial, as: 'rawMaterial' }],
        },
      ],
    });

    const recipeMap = {};
    for (const r of recipes) {
      recipeMap[r.productId] = r;
    }

    const rawMaterialRequirements = {};
    for (const prodId of Object.keys(productMap)) {
      const prodDemand = productMap[prodId];
      const recipe = recipeMap[prodId];
      if (recipe) {
        const multiplier = prodDemand.pendingQty / Number(recipe.yieldQty || 1);
        for (const mat of recipe.materials) {
          const rm = mat.rawMaterial;
          if (!rm) continue;
          if (!rawMaterialRequirements[rm.id]) {
            rawMaterialRequirements[rm.id] = {
              id: rm.id,
              name: rm.name,
              materialCode: rm.materialCode,
              unit: rm.unit,
              stock: Number(rm.stock || 0),
              requiredQty: 0,
              recipeId: recipe.id,
            };
          }
          rawMaterialRequirements[rm.id].requiredQty += Number(mat.qty) * multiplier;
        }
      }
    }

    for (const id of Object.keys(rawMaterialRequirements)) {
      rawMaterialRequirements[id].requiredQty = Number(rawMaterialRequirements[id].requiredQty.toFixed(2));
    }

    res.json({
      unfulfilledProducts: Object.values(productMap),
      requiredMaterials: Object.values(rawMaterialRequirements),
    });
  } catch (err) {
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const ManufacturingEntry = require('../models/ManufacturingEntry');
    const RepackEntry = require('../models/RepackEntry');
    const RawMaterial = require('../models/RawMaterial');
    const RawMaterialMovement = require('../models/RawMaterialMovement');
    const Invoice = require('../models/Invoice');
    const InvoiceItem = require('../models/InvoiceItem');
    const Product = require('../models/Product');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Production entries completes today & this month
    const mfgToday = await ManufacturingEntry.findAll({
      where: { status: 'completed', date: { [Op.gte]: startOfToday } }
    });
    const repackToday = await RepackEntry.findAll({
      where: { status: 'completed', date: { [Op.gte]: startOfToday } }
    });

    const mfgMonth = await ManufacturingEntry.findAll({
      where: { status: 'completed', date: { [Op.gte]: startOfMonth } }
    });
    const repackMonth = await RepackEntry.findAll({
      where: { status: 'completed', date: { [Op.gte]: startOfMonth } }
    });

    const todaysProduction = mfgToday.length;
    const todaysRepacking = repackToday.length;
    const productionThisMonth = mfgMonth.length + repackMonth.length;

    // 2. Raw materials consumed
    const consumptionToday = await RawMaterialMovement.findAll({
      where: { type: 'consumption', date: { [Op.gte]: startOfToday } }
    });
    const rawMaterialsConsumed = consumptionToday.reduce((sum, m) => sum + Math.abs(Number(m.quantity)), 0);

    // 3. Finished Goods Produced today
    const mfgProduced = mfgToday.reduce((sum, e) => sum + Number(e.qtyToProduce), 0);
    const repackProduced = repackToday.reduce((sum, e) => sum + Number(e.qtyToProduce), 0);
    const finishedGoodsProduced = mfgProduced + repackProduced;

    // 4. Pending Production Orders
    const pendingMfg = await ManufacturingEntry.count({ where: { status: 'pending' } });
    const pendingRepack = await RepackEntry.count({ where: { status: 'pending' } });
    const pendingProductionOrders = pendingMfg + pendingRepack;

    // 5. Low stock raw materials
    const materials = await RawMaterial.findAll();
    const lowStockMaterials = materials.filter(m => Number(m.stock) <= Number(m.minStock));
    const lowStockCount = lowStockMaterials.length;

    // 6. Smart Alerts
    const rawMaterialShortage = lowStockMaterials
      .filter(m => !['Pouches', 'Labels', 'Packaging Materials', 'Bottles', 'Cartons'].includes(m.category))
      .map(m => `${m.name} is low (Stock: ${m.stock} ${m.unit}, Min: ${m.minStock} ${m.unit})`);

    const packagingMaterialShortage = lowStockMaterials
      .filter(m => ['Pouches', 'Labels', 'Packaging Materials', 'Bottles', 'Cartons'].includes(m.category))
      .map(m => `${m.name} is low (Stock: ${m.stock} pcs, Min: ${m.minStock} pcs)`);

    // Production Delays
    const delayedMfg = await ManufacturingEntry.findAll({
      where: { status: 'pending', date: { [Op.lt]: startOfToday } }
    });
    const delayedRepack = await RepackEntry.findAll({
      where: { status: 'pending', date: { [Op.lt]: startOfToday } }
    });
    const productionDelays = [...delayedMfg, ...delayedRepack].map(e => {
      const orderNum = e.mfgNumber || e.repackNumber;
      return `Order ${orderNum} is delayed (Scheduled: ${new Date(e.date).toLocaleDateString()})`;
    });

    // Pending Backorders
    const pendingInvoices = await InvoiceItem.findAll({
      where: { pendingQty: { [Op.gt]: 0 } },
      include: [
        { model: Invoice, as: 'invoice', where: { status: 'Waiting For Stock' } },
        { model: Product, as: 'product' }
      ]
    });
    const pendingBackorders = pendingInvoices.map(item => {
      return `Invoice ${item.invoice?.invoiceNumber || item.invoiceId} requires ${item.pendingQty} ${item.product?.unit || 'pcs'} of ${item.product?.name || 'product'}`;
    });

    res.json({
      metrics: {
        todaysProduction,
        todaysRepacking,
        productionThisMonth,
        rawMaterialsConsumed,
        finishedGoodsProduced,
        pendingProductionOrders,
        lowStockRawMaterials: lowStockCount,
      },
      alerts: {
        rawMaterialShortage,
        packagingMaterialShortage,
        productionDelays,
        pendingBackorders,
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateEntry = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { status } = req.body;
    const { updateStock } = require('../utils/stockService');
    const Product = require('../models/Product');
    const ManufacturingEntryMaterial = require('../models/ManufacturingEntryMaterial');
    const RawMaterial = require('../models/RawMaterial');
    const RawMaterialMovement = require('../models/RawMaterialMovement');
    const ManufacturingEntry = require('../models/ManufacturingEntry');

    const entry = await ManufacturingEntry.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
        { model: ManufacturingEntryMaterial, as: 'materials', include: [{ model: RawMaterial, as: 'rawMaterial' }] }
      ],
      transaction: t
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ message: 'Entry not found' });
    }

    if (entry.status === 'completed') {
      await t.rollback();
      return res.status(400).json({ message: 'Entry already completed' });
    }

    if (status === 'completed') {
      // Perform stock validation
      for (const item of entry.materials) {
        const available = Number(item.rawMaterial.stock || 0);
        if (Number(item.qtyUsed) > available) {
          await t.rollback();
          return res.status(400).json({
            message: `Insufficient stock for raw material "${item.rawMaterial.name}". Required: ${item.qtyUsed}, Available: ${available}`
          });
        }
      }

      // Deduct raw material stocks & log movements
      for (const item of entry.materials) {
        await RawMaterial.decrement({ stock: item.qtyUsed }, { where: { id: item.rawMaterialId }, transaction: t });
        await RawMaterialMovement.create({
          rawMaterialId: item.rawMaterialId,
          type: 'consumption',
          quantity: -item.qtyUsed,
          price: item.unitCost,
          notes: `Manufacture run ${entry.mfgNumber}`,
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          createdById: req.user.id,
        }, { transaction: t });
      }

      // Add finished product stock
      const ProductPackSize = require('../models/ProductPackSize');
      if (entry.productionMode === 'pack') {
        const packSize = await ProductPackSize.findByPk(entry.packSizeId, { transaction: t });
        packSize.stock = Number(packSize.stock || 0) + Number(entry.qtyToProduce);
        await packSize.save({ transaction: t });

        const totalOutputWeight = (Number(packSize.weightInGrams) * Number(entry.qtyToProduce)) / 1000;
        await updateStock(entry.productId, totalOutputWeight, {
          type: 'manufacturing',
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          userId: req.user.id,
          transaction: t,
        });
      } else {
        await updateStock(entry.productId, entry.qtyToProduce, {
          type: 'manufacturing',
          referenceId: entry.id,
          referenceModel: 'ManufacturingEntry',
          userId: req.user.id,
          transaction: t,
        });
      }

      // update product cost
      const product = await Product.findByPk(entry.productId, { transaction: t });
      if (product) {
        const totalOutputWeight = entry.productionMode === 'pack' 
          ? (Number(entry.packSize?.weightInGrams || 0) * Number(entry.qtyToProduce)) / 1000 
          : Number(entry.qtyToProduce);
        product.purchasePrice = Number(entry.totalCost) / (totalOutputWeight || 1);
        await product.save({ transaction: t });
      }

      entry.status = 'completed';
      await entry.save({ transaction: t });
    }

    await t.commit();
    res.json({ success: true, entry });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};
