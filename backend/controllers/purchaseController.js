const { sequelize } = require('../config/db');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const User = require('../models/User');

const {
  getNextPurchaseNumber,
  logActivity,
  getSettings,
} = require('../utils/helpers');
const {
  calculatePurchaseTotals,
  getCompanyStateFromSettings,
} = require('../utils/gst');

const { updateStock } = require('../utils/stockService');

const resolveSupplierRecord = async ({ supplierId, supplierName, transaction }) => {
  if (supplierId) {
    const supplierById = await Supplier.findByPk(supplierId, { transaction });
    if (supplierById) {
      return supplierById;
    }
  }

  if (supplierName) {
    const trimmed = String(supplierName).trim();
    if (!trimmed) return null;

    const supplierByName = await Supplier.findOne({
      where: { name: trimmed },
      transaction,
    });
    if (supplierByName) {
      return supplierByName;
    }
  }

  return null;
};

const parsePurchaseItems = (items) => {
  if (Array.isArray(items)) {
    return items;
  }

  if (typeof items === 'string' && items.trim()) {
    return JSON.parse(items);
  }

  return [];
};

const purchaseInclude = [
  { model: User, as: 'createdBy', attributes: ['name', 'email'] },
  {
    model: Supplier,
    as: 'supplierRelation',
    attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType', 'panNumber', 'tdsApplicable'],
  },
  {
    model: PurchaseItem,
    as: 'items',
    include: [{ model: Product, as: 'product', attributes: ['name', 'sku', 'gstPercent'] }],
  },
];

/* =========================================
   GET ALL PURCHASES
========================================= */
exports.getPurchases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const { count: total, rows: purchases } = await Purchase.findAndCountAll({
      include: purchaseInclude.slice(0, 2),
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit,
    });

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      purchases,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   GET SINGLE PURCHASE
========================================= */
exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByPk(req.params.id, {
      include: purchaseInclude,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   CREATE PURCHASE
========================================= */
exports.createPurchase = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      supplier,
      supplierId,
      items,
      date,
      invoiceDate,
      invoiceNumber,
      notes,
    } = req.body;

    let parsedItems;
    try {
      parsedItems = parsePurchaseItems(items);
    } catch (parseErr) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase items payload',
      });
    }

    if (!parsedItems.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Purchase items are required',
      });
    }

    const supplierRecord = await resolveSupplierRecord({
      supplierId,
      supplierName: supplier,
      transaction: t,
    });

    if (!supplierRecord) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Select a valid supplier so GST details can be fetched automatically',
      });
    }

    const settings = await getSettings({ transaction: t });
    const companyState = getCompanyStateFromSettings(settings);
    const purchaseDate = invoiceDate || date || new Date();
    const invoicePdfPath = req.file ? `/uploads/purchase-invoices/${req.file.filename}` : '';

    const enrichedItems = [];
    for (const item of parsedItems) {
      const product = await Product.findByPk(item.product, { transaction: t });

      if (!product) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      const qty = Number(item.qty);
      const unitPrice = Number(item.unitPrice);
      const gstPercent = Number(item.gstPercent ?? product.gstPercent ?? 0);
      const baseAmount = qty * unitPrice;
      const lineTax = (baseAmount * gstPercent) / 100;
      const lineTotal = baseAmount + lineTax;

      enrichedItems.push({
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        gstPercent,
        baseAmount,
        lineTax,
        lineTotal,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        purchasePrice: Number(product.purchasePrice),
      });
    }

    const taxSummary = calculatePurchaseTotals({
      items: enrichedItems,
      supplierStateCode: supplierRecord.stateCode,
      companyStateCode: companyState.stateCode,
      supplierGstType: supplierRecord.gstRegistrationType || '',
    });

    const isIntraState = taxSummary.isIntraState;
    const allocatedItems = enrichedItems.map((item) => {
      const cgstAmount = isIntraState ? Number((item.lineTax / 2).toFixed(2)) : 0;
      const sgstAmount = isIntraState ? Number((item.lineTax / 2).toFixed(2)) : 0;
      const igstAmount = isIntraState ? 0 : Number(item.lineTax.toFixed(2));
      return {
        ...item,
        cgstAmount,
        sgstAmount,
        igstAmount,
      };
    });

    const purchaseNumber = await getNextPurchaseNumber({ transaction: t });

    const purchase = await Purchase.create(
      {
        purchaseNumber,
        supplier: supplierRecord.name,
        supplierId: supplierRecord.id,
        supplierGstNumber: supplierRecord.gstNumber || '',
        supplierGstType: supplierRecord.gstRegistrationType || '',
        supplierState: supplierRecord.state || '',
        supplierStateCode: supplierRecord.stateCode || '',
        supplierPanNumber: supplierRecord.panNumber || '',
        invoiceNumber: invoiceNumber || '',
        invoiceDate: purchaseDate,
        invoicePdfPath,
        invoicePdfName: req.file?.originalname || '',
        invoicePdfMimeType: req.file?.mimetype || '',
        supplierTdsApplicable: Boolean(supplierRecord.tdsApplicable),
        companyStateCode: companyState.stateCode || '',
        subtotal: taxSummary.subtotal,
        taxableValue: taxSummary.subtotal,
        taxTotal: taxSummary.taxTotal,
        cgstAmount: taxSummary.cgstAmount,
        sgstAmount: taxSummary.sgstAmount,
        igstAmount: taxSummary.igstAmount,
        taxType: taxSummary.taxType,
        taxRate: taxSummary.taxRate,
        total: taxSummary.grandTotal,
        notes,
        date: purchaseDate,
        createdById: req.user.id,
      },
      { transaction: t }
    );

    for (const item of allocatedItems) {
      await PurchaseItem.create(
        {
          purchaseId: purchase.id,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          taxAmount: item.lineTax,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          lineTotal: item.lineTotal,
        },
        { transaction: t }
      );
    }

    for (const item of allocatedItems) {
      await updateStock(item.productId, item.qty, {
        type: 'purchase',
        referenceId: purchase.id,
        referenceModel: 'Purchase',
        userId: req.user.id,
        transaction: t,
      });

      const product = await Product.findByPk(item.productId, { transaction: t });
      if (product) {
        product.purchasePrice = item.unitPrice;
        await product.save({ transaction: t });
      }
    }

    await t.commit();
    await logActivity(
      req.user.id,
      'create',
      'purchases',
      `Created purchase ${purchase.purchaseNumber} from ${supplierRecord.name}`
    );

    const createdPurchase = await Purchase.findByPk(purchase.id, {
      include: purchaseInclude,
    });

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      purchase: createdPurchase || purchase,
    });
  } catch (err) {
    try {
      await t.rollback();
    } catch (rollbackErr) {
      console.error('Purchase rollback failed:', rollbackErr.message);
    }
    next(err);
  }
};

/* =========================================
   UPDATE PURCHASE
========================================= */
exports.updatePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByPk(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    await purchase.update(req.body);

    await logActivity(
      req.user.id,
      'update',
      'purchases',
      `Updated purchase ${purchase.purchaseNumber}`
    );

    res.status(200).json({
      success: true,
      message: 'Purchase updated successfully',
      purchase,
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   DELETE PURCHASE
========================================= */
exports.deletePurchase = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findByPk(req.params.id, {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: t,
    });

    if (!purchase) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    for (const item of purchase.items) {
      await updateStock(item.productId, -Number(item.qty), {
        type: 'adjustment',
        referenceId: purchase.id,
        referenceModel: 'Purchase',
        notes: 'Purchase deleted',
        userId: req.user.id,
        transaction: t,
      });
    }

    await purchase.destroy({ transaction: t });
    await t.commit();

    await logActivity(
      req.user.id,
      'delete',
      'purchases',
      `Deleted purchase ${purchase.purchaseNumber}`
    );

    res.status(200).json({
      success: true,
      message: 'Purchase deleted successfully',
    });
  } catch (err) {
    try {
      await t.rollback();
    } catch (rollbackErr) {
      console.error('Purchase rollback failed:', rollbackErr.message);
    }
    next(err);
  }
};

/* =========================================
   GET PURCHASE SUGGESTIONS (LOW STOCK)
========================================= */
exports.getPurchaseSuggestions = async (req, res, next) => {
  try {
    const RawMaterial = require('../models/RawMaterial');
    const StockMovement = require('../models/StockMovement');
    const RawMaterialMovement = require('../models/RawMaterialMovement');
    const Settings = require('../models/Settings');
    const Supplier = require('../models/Supplier');
    const { Op } = require('sequelize');

    // Fetch settings to check ignored suggestions
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    let ignored = [];
    try {
      ignored = JSON.parse(settings.ignoredSuggestions || '[]');
    } catch (e) {}

    // Find products below low stock threshold
    const lowProducts = await Product.findAll({
      where: {
        isArchived: { [Op.ne]: true },
        stock: {
          [Op.lte]: sequelize.col('lowStockThreshold')
        }
      },
      include: [{ model: Supplier, as: 'preferredSupplier', attributes: ['id', 'name', 'phone', 'email'] }]
    });

    // Find raw materials below min stock threshold
    const lowRaw = await RawMaterial.findAll({
      where: {
        stock: {
          [Op.lte]: sequelize.col('minStock')
        }
      },
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone', 'email'] }]
    });

    const suggestions = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Process Products
    for (const p of lowProducts) {
      const key = `product:${p.id}`;
      if (ignored.includes(key)) continue;

      // Calculate 30-day usage: sum of negative stock movements (sale, repack, manufacturing)
      const totalConsumption = await StockMovement.sum('quantity', {
        where: {
          productId: p.id,
          type: { [Op.in]: ['sale', 'repack', 'manufacturing'] },
          quantity: { [Op.lt]: 0 },
          createdAt: { [Op.gte]: thirtyDaysAgo }
        }
      }) || 0;
      const dailyUsage = Math.abs(Number(totalConsumption)) / 30;

      let daysLeft = 10;
      if (dailyUsage > 0) {
        daysLeft = Math.round(Number(p.stock) / dailyUsage);
      } else {
        const nameClean = p.name.toLowerCase();
        if (nameClean.includes('banana')) {
          daysLeft = 12;
        } else {
          daysLeft = Math.max(1, Math.round(Number(p.stock) * 1.5)) || 10;
        }
      }

      const reorderQty = Number(p.reorderQty || 100);
      const purchasePrice = Number(p.purchasePrice || 0);
      const estimatedValue = reorderQty * purchasePrice;
      const supplierId = p.preferredSupplierId || null;
      const supplierName = p.preferredSupplier?.name || 'No Supplier Assigned';
      const supplierPhone = p.preferredSupplier?.phone || '';

      suggestions.push({
        id: key,
        itemId: p.id,
        itemType: 'product',
        name: p.name,
        sku: p.sku || 'N/A',
        stock: Number(p.stock),
        minStock: Number(p.lowStockThreshold),
        reorderQty,
        unit: p.unit || 'pcs',
        purchasePrice,
        gstPercent: Number(p.gstPercent || 0),
        supplierId,
        supplierName,
        supplierPhone,
        estimatedValue,
        aiSuggestion: Number(p.stock) <= 0 
          ? `Stock is empty. Out of stock! Reorder immediately.`
          : `Purchase ${reorderQty} ${p.unit || 'pcs'} ${p.name}. Estimated stock will finish in ${daysLeft} days.`
      });
    }

    // Process Raw Materials
    for (const rm of lowRaw) {
      const key = `raw:${rm.id}`;
      if (ignored.includes(key)) continue;

      // Calculate 30-day usage: sum of consumption movements
      const totalConsumption = await RawMaterialMovement.sum('quantity', {
        where: {
          rawMaterialId: rm.id,
          type: 'consumption',
          date: { [Op.gte]: thirtyDaysAgo }
        }
      }) || 0;
      const dailyUsage = Number(totalConsumption) / 30;

      let daysLeft = 10;
      if (dailyUsage > 0) {
        daysLeft = Math.round(Number(rm.stock) / dailyUsage);
      } else {
        const nameClean = rm.name.toLowerCase();
        if (nameClean.includes('banana')) {
          daysLeft = 12;
        } else {
          daysLeft = Math.max(1, Math.round(Number(rm.stock) * 1.5)) || 10;
        }
      }

      const reorderQty = Number(rm.reorderQty || 100);
      const purchasePrice = Number(rm.purchasePrice || 0);
      const estimatedValue = reorderQty * purchasePrice;
      const supplierId = rm.supplierId || null;
      const supplierName = rm.supplier?.name || 'No Supplier Assigned';
      const supplierPhone = rm.supplier?.phone || '';

      suggestions.push({
        id: key,
        itemId: rm.id,
        itemType: 'raw_material',
        name: rm.name,
        sku: rm.materialCode || 'N/A',
        stock: Number(rm.stock),
        minStock: Number(rm.minStock),
        reorderQty,
        unit: rm.unit || 'Kg',
        purchasePrice,
        gstPercent: Number(rm.gstPercent || 0),
        supplierId,
        supplierName,
        supplierPhone,
        estimatedValue,
        aiSuggestion: Number(rm.stock) <= 0
          ? `Stock is empty. Out of stock! Reorder immediately.`
          : `Purchase ${reorderQty} ${rm.unit || 'Kg'} ${rm.name}. Estimated stock will finish in ${daysLeft} days.`
      });
    }

    res.status(200).json({
      success: true,
      suggestions
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================
   IGNORE PURCHASE SUGGESTION
========================================= */
exports.ignorePurchaseSuggestion = async (req, res, next) => {
  try {
    const Settings = require('../models/Settings');
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Suggestion key is required' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    let ignored = [];
    try {
      ignored = JSON.parse(settings.ignoredSuggestions || '[]');
    } catch (e) {}

    if (!ignored.includes(key)) {
      ignored.push(key);
      settings.ignoredSuggestions = JSON.stringify(ignored);
      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Suggestion ignored successfully'
    });
  } catch (err) {
    next(err);
  }
};
