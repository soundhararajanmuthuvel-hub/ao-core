const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const RawMaterial = require('../models/RawMaterial');
const RawMaterialMovement = require('../models/RawMaterialMovement');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const { logActivity } = require('../utils/helpers');
const { recalculateAllProductPrices } = require('../utils/priceService');

// Get all raw materials (with pagination, search, category filter)
exports.getMaterials = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';

    const query = {};
    if (category) query.category = category;
    if (search) {
      query[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { materialCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count: total, rows: materials } = await RawMaterial.findAndCountAll({
      where: query,
      include: [{ model: Supplier, as: 'supplier', attributes: ['name'] }],
      order: [['name', 'ASC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ materials, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// Create raw material
exports.createMaterial = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.supplierId === '') {
      data.supplierId = null;
    }
    const material = await RawMaterial.create(data);
    await logActivity(req.user.id, 'create', 'inventory', `Created raw material ${material.name}`);
    await recalculateAllProductPrices();
    res.status(201).json({ material });
  } catch (err) {
    next(err);
  }
};

// Update raw material
exports.updateMaterial = async (req, res, next) => {
  try {
    const material = await RawMaterial.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Raw material not found' });

    const data = { ...req.body };
    if (data.supplierId === '') {
      data.supplierId = null;
    }
    await material.update(data);
    await logActivity(req.user.id, 'update', 'inventory', `Updated raw material ${material.name}`);
    await recalculateAllProductPrices();
    res.json({ material });
  } catch (err) {
    next(err);
  }
};

// Delete raw material
exports.deleteMaterial = async (req, res, next) => {
  try {
    const material = await RawMaterial.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Raw material not found' });

    await material.destroy();
    await logActivity(req.user.id, 'delete', 'inventory', `Deleted raw material ${material.name}`);
    res.json({ message: 'Raw material deleted' });
  } catch (err) {
    next(err);
  }
};

// Purchase raw material (Stock replenishment)
exports.purchaseMaterial = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { rawMaterialId, quantity, price, supplierId, notes } = req.body;
    if (!rawMaterialId || !quantity || quantity <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Valid material and quantity are required.' });
    }

    const material = await RawMaterial.findByPk(rawMaterialId, { transaction: t });
    if (!material) {
      await t.rollback();
      return res.status(404).json({ message: 'Raw material not found.' });
    }

    const { convertUnit } = require('../utils/unitHelper');
    const baseQtyVal = convertUnit(Number(quantity), material.purchaseUnit, material.baseUnit);
    const totalCostOfPurchase = Number(quantity) * Number(price || 0);
    const pricePerBaseUnit = baseQtyVal > 0 ? (totalCostOfPurchase / baseQtyVal) : Number(price || 0);

    const currentStock = Number(material.stock || 0);
    const currentPrice = Number(material.purchasePrice || 0);

    // Calculate new weighted average cost per base unit
    let newPurchasePrice = pricePerBaseUnit;
    if (currentStock > 0 && (currentStock + baseQtyVal) > 0) {
      newPurchasePrice = ((currentStock * currentPrice) + totalCostOfPurchase) / (currentStock + baseQtyVal);
    }

    material.stock = currentStock + baseQtyVal;
    material.purchasePrice = newPurchasePrice;
    if (supplierId) material.supplierId = supplierId;
    await material.save({ transaction: t });

    const movement = await RawMaterialMovement.create({
      rawMaterialId,
      type: 'purchase',
      quantity: baseQtyVal,
      price: pricePerBaseUnit,
      notes: notes || `Purchased ${quantity} ${material.purchaseUnit} at ${price}/${material.purchaseUnit}`,
      supplierId: supplierId || material.supplierId,
      createdById: req.user.id,
    }, { transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'purchase_raw', 'inventory', `Purchased ${quantity} ${material.purchaseUnit} of ${material.name} (converted to ${baseQtyVal.toFixed(2)} ${material.baseUnit})`);
    await recalculateAllProductPrices();

    res.json({ material, movement });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Adjust stock manually
exports.adjustStock = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { rawMaterialId, quantity, notes } = req.body;
    if (!rawMaterialId || quantity === undefined || isNaN(quantity)) {
      await t.rollback();
      return res.status(400).json({ message: 'Valid material and quantity are required.' });
    }

    const material = await RawMaterial.findByPk(rawMaterialId, { transaction: t });
    if (!material) {
      await t.rollback();
      return res.status(404).json({ message: 'Raw material not found.' });
    }

    const currentStock = Number(material.stock || 0);
    const adjustmentQty = Number(quantity); // Quantity change (can be positive or negative)

    material.stock = currentStock + adjustmentQty;
    await material.save({ transaction: t });

    const movement = await RawMaterialMovement.create({
      rawMaterialId,
      type: 'adjustment',
      quantity: adjustmentQty,
      price: material.purchasePrice,
      notes: notes || 'Manual stock adjustment',
      createdById: req.user.id,
    }, { transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'adjust_raw', 'inventory', `Adjusted raw stock of ${material.name} by ${adjustmentQty}`);
    await recalculateAllProductPrices();

    res.json({ material, movement });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Get movements history log
exports.getMovements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const rawMaterialId = req.query.rawMaterialId;

    const query = {};
    if (rawMaterialId) query.rawMaterialId = rawMaterialId;

    const { count: total, rows: movements } = await RawMaterialMovement.findAndCountAll({
      where: query,
      include: [
        { model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] },
        { model: Supplier, as: 'supplier', attributes: ['name'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
      ],
      order: [['date', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ movements, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// Get Dashboard metrics and reports data
exports.getReport = async (req, res, next) => {
  try {
    const materials = await RawMaterial.findAll({
      include: [{ model: Supplier, as: 'supplier', attributes: ['name'] }],
      order: [['name', 'ASC']]
    });

    const totalMaterials = materials.length;
    const lowStockMaterials = materials.filter(m => m.isLowStock).length;
    const materialValue = materials.reduce((sum, m) => sum + (Number(m.stock) * Number(m.purchasePrice)), 0);

    // Calculate consumption sum (total raw materials consumed)
    const consumptionSum = await RawMaterialMovement.sum('quantity', {
      where: {
        type: 'consumption',
      }
    }) || 0;

    // Daily consumption log for reports
    const consumptions = await RawMaterialMovement.findAll({
      where: { type: 'consumption' },
      include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] }],
      order: [['date', 'DESC']],
      limit: 100,
    });

    // Purchases log
    const purchases = await RawMaterialMovement.findAll({
      where: { type: 'purchase' },
      include: [
        { model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] },
        { model: Supplier, as: 'supplier', attributes: ['name'] }
      ],
      order: [['date', 'DESC']],
      limit: 100,
    });

    res.json({
      cards: {
        totalMaterials,
        lowStockMaterials,
        materialConsumption: Math.abs(consumptionSum),
        materialValue,
      },
      reports: {
        materialsList: materials,
        consumptions,
        purchases,
      }
    });
  } catch (err) {
    next(err);
  }
};
