const { Op } = require('sequelize');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const { updateStock } = require('../utils/stockService');
const { logActivity } = require('../utils/helpers');

const movementOpts = async (body, userId) => {
  const { supplierId, notes } = body;
  let noteText = notes || '';
  let supplier = supplierId || undefined;
  if (supplierId) {
    const s = await Supplier.findByPk(supplierId);
    if (s) noteText = noteText ? `${noteText} | Supplier: ${s.name}` : `Supplier: ${s.name}`;
  }
  return { notes: noteText, supplier, userId };
};

exports.getMovements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const query = {};
    if (req.query.product) query.productId = req.query.product;
    if (req.query.type) query.type = req.query.type;

    const { count: total, rows: movements } = await StockMovement.findAndCountAll({
      where: query,
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku'] },
        { model: Supplier, as: 'supplier', attributes: ['name', 'phone', 'type'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ movements, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, quantity, batchNumber, expiryDate } = req.body;
    const opts = await movementOpts(req.body, req.user.id);
    const product = await updateStock(productId, Number(quantity), {
      type: 'adjustment',
      batchNumber: batchNumber || null,
      expiryDate: expiryDate || null,
      ...opts,
    });
    await logActivity(req.user.id, 'adjust', 'inventory', `Adjusted stock for ${product.name}`);
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

exports.repack = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { fromProductId, toProductId, fromQty, toQty } = req.body;
    const opts = await movementOpts(req.body, req.user.id);
    await updateStock(fromProductId, -Number(fromQty), { type: 'repack', ...opts, transaction: t });
    await updateStock(toProductId, Number(toQty), { type: 'repack', ...opts, transaction: t });
    await t.commit();
    await logActivity(req.user.id, 'repack', 'inventory', `Repack: ${fromQty} → ${toQty}`);
    res.json({ message: 'Repack successful' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.manufacturing = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { inputs, outputs } = req.body;
    const opts = await movementOpts(req.body, req.user.id);
    for (const input of inputs) {
      await updateStock(input.productId, -Number(input.qty), { type: 'manufacturing', ...opts, transaction: t });
    }
    for (const output of outputs) {
      await updateStock(output.productId, Number(output.qty), { type: 'manufacturing', ...opts, transaction: t });
    }
    await t.commit();
    await logActivity(req.user.id, 'manufacturing', 'inventory', 'Manufacturing completed');
    res.json({ message: 'Manufacturing successful' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const ProductPackSize = require('../models/ProductPackSize');
    const products = await Product.findAll({ 
      where: { isArchived: { [Op.ne]: true } },
      include: [{ model: ProductPackSize, as: 'packSizes' }],
      order: [['name', 'ASC']] 
    });
    const totalValue = products.reduce((sum, p) => sum + Number(p.stock) * Number(p.purchasePrice), 0);
    const lowStock = products.filter((p) => Number(p.stock) <= Number(p.lowStockThreshold));
    res.json({ products, totalValue, lowStockCount: lowStock.length, lowStock });
  } catch (err) {
    next(err);
  }
};

exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const RawMaterial = require('../models/RawMaterial');
    const products = await Product.findAll({
      where: { isArchived: { [Op.ne]: true } },
      attributes: ['id', 'name', 'sku', 'stock', 'lowStockThreshold', 'unit', 'productType'],
    });

    const rawMaterials = await RawMaterial.findAll({
      attributes: ['id', 'name', 'materialCode', 'stock', 'minStock', 'unit', 'category'],
    });

    const critical = [];
    const warning = [];
    const normal = [];

    products.forEach((p) => {
      const stock = Number(p.stock || 0);
      const min = Number(p.lowStockThreshold || 0);
      const item = {
        id: `product:${p.id}`,
        itemId: p.id,
        itemType: 'product',
        name: p.name,
        sku: p.sku || 'N/A',
        stock,
        minStock: min,
        unit: p.unit || 'pcs',
        type: p.productType,
      };

      if (stock <= 0) {
        critical.push(item);
      } else if (stock <= min) {
        warning.push(item);
      } else {
        normal.push(item);
      }
    });

    rawMaterials.forEach((r) => {
      const stock = Number(r.stock || 0);
      const min = Number(r.minStock || 0);
      const item = {
        id: `raw:${r.id}`,
        itemId: r.id,
        itemType: 'raw_material',
        name: r.name,
        sku: r.materialCode || 'N/A',
        stock,
        minStock: min,
        unit: r.unit || 'Kg',
        type: r.category,
      };

      if (stock <= 0) {
        critical.push(item);
      } else if (stock <= min) {
        warning.push(item);
      } else {
        normal.push(item);
      }
    });

    res.json({
      critical,
      warning,
      normal,
      counts: {
        critical: critical.length,
        warning: warning.length,
        normal: normal.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getProductBatches = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const movements = await StockMovement.findAll({
      where: { productId },
      order: [['createdAt', 'ASC']]
    });

    const batchMap = {};
    for (const mov of movements) {
      if (!mov.batchNumber) continue;
      if (!batchMap[mov.batchNumber]) {
        batchMap[mov.batchNumber] = {
          batchNumber: mov.batchNumber,
          expiryDate: mov.expiryDate,
          manufacturedQty: 0,
          soldQty: 0,
          remainingQty: 0
        };
      }
      const qty = Number(mov.quantity);
      if (qty > 0) {
        batchMap[mov.batchNumber].manufacturedQty += qty;
      } else if (mov.type === 'sale') {
        batchMap[mov.batchNumber].soldQty += Math.abs(qty);
      }
      batchMap[mov.batchNumber].remainingQty += qty;
    }

    res.json(Object.values(batchMap));
  } catch (err) {
    next(err);
  }
};

exports.getStockLossRegister = async (req, res, next) => {
  try {
    const StockLoss = require('../models/StockLoss');
    const Product = require('../models/Product');
    const RawMaterial = require('../models/RawMaterial');
    const User = require('../models/User');

    const losses = await StockLoss.findAll({
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku', 'unit'] },
        { model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] },
        { model: User, as: 'createdBy', attributes: ['name'] }
      ],
      order: [['date', 'DESC']]
    });
    res.json(losses);
  } catch (err) {
    next(err);
  }
};

exports.createStockLoss = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { itemType, productId, rawMaterialId, quantity, reason, notes } = req.body;
    const qty = Number(quantity);
    if (!itemType || !qty || qty <= 0 || !reason) {
      await t.rollback();
      return res.status(400).json({ message: 'Item type, positive quantity, and reason are required.' });
    }

    const StockLoss = require('../models/StockLoss');
    const Product = require('../models/Product');
    const RawMaterial = require('../models/RawMaterial');
    const RawMaterialMovement = require('../models/RawMaterialMovement');

    let unitCost = 0;
    if (itemType === 'finished_goods') {
      if (!productId) {
        await t.rollback();
        return res.status(400).json({ message: 'Product ID is required for finished goods.' });
      }
      const product = await Product.findByPk(productId, { transaction: t });
      if (!product) {
        await t.rollback();
        return res.status(404).json({ message: 'Product not found.' });
      }
      unitCost = Number(product.purchasePrice || 0);

      // Decrement stock (will trigger FIFO deduction in stockService automatically)
      await updateStock(productId, -qty, {
        type: 'adjustment',
        notes: `Stock Loss: ${reason}. Notes: ${notes || ''}`,
        userId: req.user.id,
        transaction: t
      });
    } else {
      if (!rawMaterialId) {
        await t.rollback();
        return res.status(400).json({ message: 'Raw Material ID is required.' });
      }
      const rm = await RawMaterial.findByPk(rawMaterialId, { transaction: t });
      if (!rm) {
        await t.rollback();
        return res.status(404).json({ message: 'Raw material/packaging not found.' });
      }
      if (Number(rm.stock || 0) < qty) {
        await t.rollback();
        return res.status(400).json({ message: `Insufficient stock. Available: ${rm.stock}, Required: ${qty}` });
      }
      unitCost = Number(rm.purchasePrice || 0);

      // Decrement stock directly
      rm.stock = Number(rm.stock) - qty;
      await rm.save({ transaction: t });

      // Record movement
      await RawMaterialMovement.create({
        rawMaterialId,
        type: 'adjustment',
        quantity: -qty,
        price: unitCost,
        notes: `Stock Loss: ${reason}. Notes: ${notes || ''}`,
        createdById: req.user.id,
      }, { transaction: t });
    }

    const totalLossValue = qty * unitCost;

    const loss = await StockLoss.create({
      itemType,
      productId: itemType === 'finished_goods' ? productId : null,
      rawMaterialId: itemType !== 'finished_goods' ? rawMaterialId : null,
      quantity: qty,
      reason,
      unitCost,
      totalLossValue,
      notes,
      createdById: req.user.id
    }, { transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'adjust', 'inventory', `Logged ${reason} stock loss of ${qty} units`);
    
    // Query fully populated record to return
    const populated = await StockLoss.findByPk(loss.id, {
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku', 'unit'] },
        { model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'materialCode', 'unit'] },
        { model: User, as: 'createdBy', attributes: ['name'] }
      ]
    });

    res.status(201).json(populated);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getLossDashboard = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const StockLoss = require('../models/StockLoss');
    const Invoice = require('../models/Invoice');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyLossValue = await StockLoss.sum('totalLossValue', {
      where: {
        date: { [Op.gte]: startOfMonth }
      }
    }) || 0;

    const monthlySalesRevenue = await Invoice.sum('grandTotal', {
      where: {
        status: { [Op.ne]: 'Cancelled' },
        date: { [Op.gte]: startOfMonth }
      }
    }) || 0;

    const lossPercentage = monthlySalesRevenue > 0
      ? (monthlyLossValue / monthlySalesRevenue) * 100
      : 0;

    res.json({
      monthlyLossValue,
      lossPercentage: Number(lossPercentage.toFixed(2))
    });
  } catch (err) {
    next(err);
  }
};

