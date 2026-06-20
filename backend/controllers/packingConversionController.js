const { sequelize } = require('../config/db');
const Product = require('../models/Product');
const PackingConversion = require('../models/PackingConversion');
const PackingConversionItem = require('../models/PackingConversionItem');
const User = require('../models/User');
const { updateStock } = require('../utils/stockService');
const { logActivity } = require('../utils/helpers');

// Create Packing Conversion
exports.createPackingConversion = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { sourceProductId, notes, items } = req.body;

    if (!sourceProductId) {
      await t.rollback();
      return res.status(400).json({ message: 'Source bulk product is required.' });
    }

    if (!items || !items.length) {
      await t.rollback();
      return res.status(400).json({ message: 'At least one target pack size is required.' });
    }

    // Load source product
    const sourceProduct = await Product.findByPk(sourceProductId, { transaction: t });
    if (!sourceProduct) {
      await t.rollback();
      return res.status(404).json({ message: 'Source bulk product not found.' });
    }

    if (sourceProduct.productType !== 'BULK_PRODUCT') {
      await t.rollback();
      return res.status(400).json({ message: 'Source product must be of type BULK_PRODUCT.' });
    }

    // Validate stock and compute total weight consumption
    let computedTotalConsumed = 0;
    const validatedItems = [];

    for (const item of items) {
      const qty = Number(item.qty);
      if (!item.targetProductId || isNaN(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid target product or positive quantity.' });
      }

      const targetProduct = await Product.findByPk(item.targetProductId, { transaction: t });
      if (!targetProduct) {
        await t.rollback();
        return res.status(404).json({ message: `Target variant product ID ${item.targetProductId} not found.` });
      }

      const factor = Number(targetProduct.conversionFactor || 0);
      if (factor <= 0) {
        await t.rollback();
        return res.status(400).json({ message: `Target variant product ${targetProduct.name} does not have a valid conversion factor.` });
      }

      const totalWeight = qty * factor;
      computedTotalConsumed += totalWeight;

      validatedItems.push({
        targetProductId: targetProduct.id,
        targetProductName: targetProduct.name,
        qty,
        conversionFactor: factor,
        totalWeight,
      });
    }

    // Check available stock
    const availableStock = Number(sourceProduct.stock || 0);
    if (availableStock < computedTotalConsumed) {
      await t.rollback();
      return res.status(400).json({
        message: `Insufficient stock for bulk product "${sourceProduct.name}". Required: ${computedTotalConsumed.toFixed(2)} ${sourceProduct.unit || 'KG'}, Available: ${availableStock.toFixed(2)} ${sourceProduct.unit || 'KG'}`
      });
    }

    // Generate packing conversion sequential number
    const count = await PackingConversion.count({ transaction: t });
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const conversionNumber = `PC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Create entry
    const packingConversion = await PackingConversion.create({
      conversionNumber,
      date: new Date(),
      sourceProductId,
      sourceQty: computedTotalConsumed,
      notes: notes || `Packed into ${validatedItems.length} variant(s).`,
      createdById: req.user.id,
      status: 'completed',
    }, { transaction: t });

    // Deduct bulk product stock
    await updateStock(sourceProductId, -computedTotalConsumed, {
      type: 'packing_conversion',
      referenceId: packingConversion.id,
      referenceModel: 'PackingConversion',
      userId: req.user.id,
      transaction: t,
      notes: `Packed into variants: ${validatedItems.map(i => `${i.qty} x ${i.targetProductName}`).join(', ')}`,
    });

    // Create items and update variant stock
    for (const vItem of validatedItems) {
      await PackingConversionItem.create({
        packingConversionId: packingConversion.id,
        targetProductId: vItem.targetProductId,
        qty: vItem.qty,
        conversionFactor: vItem.conversionFactor,
        totalWeight: vItem.totalWeight,
      }, { transaction: t });

      await updateStock(vItem.targetProductId, vItem.qty, {
        type: 'packing_conversion',
        referenceId: packingConversion.id,
        referenceModel: 'PackingConversion',
        userId: req.user.id,
        transaction: t,
        notes: `Packed from bulk: ${sourceProduct.name}`,
      });
    }

    await t.commit();
    await logActivity(req.user.id, 'create_packing_conversion', 'inventory', `Executed packing conversion ${conversionNumber}`);

    const populated = await PackingConversion.findByPk(packingConversion.id, {
      include: [
        { model: Product, as: 'sourceProduct', attributes: ['name', 'sku', 'unit'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
        {
          model: PackingConversionItem,
          as: 'items',
          include: [{ model: Product, as: 'targetProduct', attributes: ['name', 'sku', 'unit'] }],
        },
      ],
    });

    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// List Packing Conversions
exports.getPackingConversions = async (req, res, next) => {
  try {
    const list = await PackingConversion.findAll({
      include: [
        { model: Product, as: 'sourceProduct', attributes: ['name', 'sku', 'unit'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
        {
          model: PackingConversionItem,
          as: 'items',
          include: [{ model: Product, as: 'targetProduct', attributes: ['name', 'sku', 'unit'] }],
        },
      ],
      order: [['date', 'DESC']],
    });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

// Reverse Packing Conversion
exports.reversePackingConversion = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const conversion = await PackingConversion.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'sourceProduct' },
        {
          model: PackingConversionItem,
          as: 'items',
          include: [{ model: Product, as: 'targetProduct' }],
        },
      ],
      transaction: t,
    });

    if (!conversion) {
      await t.rollback();
      return res.status(404).json({ message: 'Packing conversion entry not found' });
    }

    if (conversion.status !== 'completed') {
      await t.rollback();
      return res.status(400).json({ message: 'Only completed packing conversions can be reversed.' });
    }

    // 1. Return bulk product stock
    await updateStock(conversion.sourceProductId, Number(conversion.sourceQty), {
      type: 'packing_conversion',
      referenceId: conversion.id,
      referenceModel: 'PackingConversion',
      userId: req.user.id,
      transaction: t,
      notes: `Reversal of packing conversion ${conversion.conversionNumber}`,
    });

    // 2. Deduct variant product stock
    for (const item of conversion.items) {
      await updateStock(item.targetProductId, -Number(item.qty), {
        type: 'packing_conversion',
        referenceId: conversion.id,
        referenceModel: 'PackingConversion',
        userId: req.user.id,
        transaction: t,
        notes: `Reversal of packing conversion ${conversion.conversionNumber}`,
      });
    }

    conversion.status = 'reversed';
    await conversion.save({ transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'reverse_packing_conversion', 'inventory', `Reversed packing conversion ${conversion.conversionNumber}`);

    res.json({ message: 'Packing conversion successfully reversed.', conversion });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};
