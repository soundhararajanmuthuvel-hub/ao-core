const { Op } = require('sequelize');
const Supplier = require('../models/Supplier');
const { logActivity } = require('../utils/helpers');
const RawMaterialMovement = require('../models/RawMaterialMovement');
const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const { roundMoney } = require('../utils/gst');

const buildSupplierFinancials = async (supplierIds = []) => {
  if (!supplierIds.length) {
    return {};
  }

  const [purchaseRows, rawPurchaseRows] = await Promise.all([
    Purchase.findAll({
      where: { supplierId: supplierIds },
      attributes: ['supplierId', 'total', 'paymentStatus', 'date'],
    }),
    RawMaterialMovement.findAll({
      where: { supplierId: supplierIds, type: 'purchase' },
      attributes: ['supplierId', 'quantity', 'price', 'paymentStatus', 'date'],
    }),
  ]);

  const summary = {};
  const ensure = (supplierId) => {
    if (!summary[supplierId]) {
      summary[supplierId] = {
        outstandingAmount: 0,
        lastPurchaseDate: null,
        purchaseCount: 0,
      };
    }
    return summary[supplierId];
  };

  const recordPurchase = (supplierId, amount, paymentStatus, date) => {
    if (!supplierId) return;
    const entry = ensure(supplierId);
    entry.purchaseCount += 1;
    if (paymentStatus === 'Pending') {
      entry.outstandingAmount = roundMoney(entry.outstandingAmount + amount);
    }
    if (date) {
      const current = entry.lastPurchaseDate ? new Date(entry.lastPurchaseDate) : null;
      const next = new Date(date);
      if (!current || next > current) {
        entry.lastPurchaseDate = next;
      }
    }
  };

  purchaseRows.forEach((row) => {
    recordPurchase(row.supplierId, Number(row.total || 0), row.paymentStatus, row.date);
  });

  rawPurchaseRows.forEach((row) => {
    const amount = Number(row.quantity || 0) * Number(row.price || 0);
    recordPurchase(row.supplierId, amount, row.paymentStatus, row.date);
  });

  return summary;
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const query = {};
    if (!includeInactive) {
      query.isActive = true;
    }
    if (req.query.type) query.type = req.query.type;
    
    if (req.query.search) {
      const search = `%${req.query.search}%`;
      query[Op.or] = [
        { name: { [Op.like]: search } },
        { phone: { [Op.like]: search } },
        { email: { [Op.like]: search } },
        { gstNumber: { [Op.like]: search } },
        { panNumber: { [Op.like]: search } },
        { state: { [Op.like]: search } },
        { gstRegistrationType: { [Op.like]: search } },
      ];
    }

    const suppliers = await Supplier.findAll({
      where: query,
      order: [['name', 'ASC']],
    });

    const financials = await buildSupplierFinancials(suppliers.map((supplier) => supplier.id));
    const suppliersWithMetrics = suppliers.map((supplier) => {
      const data = supplier.get({ plain: true });
      const metrics = financials[data.id] || {};
      return {
        ...data,
        outstandingAmount: metrics.outstandingAmount || 0,
        lastPurchaseDate: metrics.lastPurchaseDate || null,
        purchaseCount: metrics.purchaseCount || 0,
      };
    });

    res.json({ suppliers: suppliersWithMetrics });
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    await logActivity(req.user.id, 'create', 'suppliers', `Created supplier ${supplier.name}`);
    res.status(201).json({ supplier });
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    
    await supplier.update(req.body);
    res.json({ supplier });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    
    await supplier.update({ isActive: false });
    res.json({ message: 'Supplier deactivated' });
  } catch (err) {
    next(err);
  }
};

exports.getSupplierDashboard = async (req, res, next) => {
  try {
    // 1. Total suppliers count (active only)
    const totalSuppliers = await Supplier.count({ where: { isActive: true } });
    const activeSuppliers = await Supplier.count({ where: { isActive: true } });

    // 2. Outstanding Payables:
    // Sum raw material purchases where paymentStatus = 'Pending'
    const rmPending = await RawMaterialMovement.findAll({
      where: { type: 'purchase', paymentStatus: 'Pending' }
    });
    let rmPendingSum = 0;
    rmPending.forEach(m => {
      rmPendingSum += Number(m.quantity) * Number(m.price || 0);
    });

    // Sum product purchases where paymentStatus = 'Pending'
    const prodPendingSum = await Purchase.sum('total', {
      where: { paymentStatus: 'Pending' }
    }) || 0;

    const outstandingPayables = rmPendingSum + Number(prodPendingSum);

    // 3. Top Suppliers (by total purchase volume)
    const rmPurchases = await RawMaterialMovement.findAll({
      where: { type: 'purchase' },
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType'] }]
    });

    const supplierSpend = {};
    rmPurchases.forEach(p => {
      const supplierName = p.supplier?.name || 'Unknown Supplier';
      const spend = Number(p.quantity) * Number(p.price || 0);
      supplierSpend[supplierName] = (supplierSpend[supplierName] || 0) + spend;
    });

    const prodPurchases = await Purchase.findAll({
      include: [{ model: Supplier, as: 'supplierRelation', attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType'] }]
    });
    prodPurchases.forEach(p => {
      const supplierName = p.supplier || p.supplierRelation?.name || 'Unknown Supplier';
      supplierSpend[supplierName] = (supplierSpend[supplierName] || 0) + Number(p.total || 0);
    });

    const topSuppliers = Object.entries(supplierSpend)
      .map(([name, spend]) => ({ name, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    // 4. Low Stock Purchase Suggestions:
    const lowStockMaterials = await RawMaterial.findAll({
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }]
    });

    const suggestions = lowStockMaterials
      .filter(m => Number(m.stock) <= Number(m.minStock))
      .map(m => ({
        materialId: m.id,
        materialName: m.name,
        materialCode: m.materialCode,
        stock: Number(m.stock),
        minStock: Number(m.minStock),
        unit: m.unit,
        suggestedSupplier: m.supplier?.name || 'No Supplier Assigned',
        supplierId: m.supplierId,
      }));

    // 5. Recent Purchases (last 5)
    const formattedRmPurchases = rmPurchases.map(p => ({
      id: p.id,
      type: 'raw',
      date: p.date,
      item: p.notes || `Purchased raw material`,
      total: Number(p.quantity) * Number(p.price || 0),
      supplier: p.supplier?.name || 'Unknown',
      supplierId: p.supplierId,
      supplierGstNumber: p.supplier?.gstNumber || '',
      supplierState: p.supplier?.state || '',
      supplierStateCode: p.supplier?.stateCode || '',
      supplierGstType: p.supplier?.gstRegistrationType || '',
      paymentStatus: p.paymentStatus,
    }));

    const formattedProdPurchases = prodPurchases.map(p => ({
      id: p.id,
      type: 'product',
      date: p.date,
      item: p.purchaseNumber || `Purchase #${p.id}`,
      total: Number(p.total),
      supplier: p.supplier || p.supplierRelation?.name || 'Unknown',
      supplierId: p.supplierId,
      supplierGstNumber: p.supplierGstNumber || p.supplierRelation?.gstNumber || '',
      supplierState: p.supplierState || p.supplierRelation?.state || '',
      supplierStateCode: p.supplierStateCode || p.supplierRelation?.stateCode || '',
      supplierGstType: p.supplierGstType || p.supplierRelation?.gstRegistrationType || '',
      paymentStatus: p.paymentStatus,
    }));

    const recentPurchases = [...formattedRmPurchases, ...formattedProdPurchases]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    res.json({
      metrics: {
        totalSuppliers,
        activeSuppliers,
        outstandingPayables,
      },
      topSuppliers,
      recentPurchases,
      suggestions,
    });
  } catch (err) {
    next(err);
  }
};

exports.getSupplierPurchases = async (req, res, next) => {
  try {
    const rmPurchases = await RawMaterialMovement.findAll({
      where: { type: 'purchase' },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType'] },
        { model: RawMaterial, as: 'rawMaterial', attributes: ['name', 'unit'] }
      ]
    });

    const prodPurchases = await Purchase.findAll({
      include: [{ model: Supplier, as: 'supplierRelation', attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType'] }]
    });

    const formattedRmPurchases = rmPurchases.map(p => ({
      id: p.id,
      type: 'raw',
      date: p.date,
      itemName: p.rawMaterial?.name || 'Raw Material',
      qty: `${p.quantity} ${p.rawMaterial?.unit || 'Kg'}`,
      total: Number(p.quantity) * Number(p.price || 0),
      supplier: p.supplier?.name || 'Unknown',
      supplierId: p.supplierId,
      supplierGstNumber: p.supplier?.gstNumber || '',
      supplierState: p.supplier?.state || '',
      supplierStateCode: p.supplier?.stateCode || '',
      supplierGstType: p.supplier?.gstRegistrationType || '',
      paymentStatus: p.paymentStatus,
    }));

    const formattedProdPurchases = prodPurchases.map(p => ({
      id: p.id,
      type: 'product',
      date: p.date,
      itemName: p.purchaseNumber || 'Finished Goods',
      qty: 'Multiple items',
      total: Number(p.total),
      supplier: p.supplier || p.supplierRelation?.name || 'Unknown',
      supplierId: p.supplierId,
      supplierGstNumber: p.supplierGstNumber || p.supplierRelation?.gstNumber || '',
      supplierState: p.supplierState || p.supplierRelation?.state || '',
      supplierStateCode: p.supplierStateCode || p.supplierRelation?.stateCode || '',
      supplierGstType: p.supplierGstType || p.supplierRelation?.gstRegistrationType || '',
      paymentStatus: p.paymentStatus,
    }));

    const allPurchases = [...formattedRmPurchases, ...formattedProdPurchases]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ purchases: allPurchases });
  } catch (err) {
    next(err);
  }
};

exports.paySupplierPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (type === 'raw') {
      const movement = await RawMaterialMovement.findByPk(id);
      if (!movement) return res.status(404).json({ message: 'Purchase record not found' });
      movement.paymentStatus = 'Paid';
      await movement.save();
    } else {
      const purchase = await Purchase.findByPk(id);
      if (!purchase) return res.status(404).json({ message: 'Purchase record not found' });
      purchase.paymentStatus = 'Paid';
      await purchase.save();
    }

    res.json({ success: true, message: 'Purchase payment marked as Paid' });
  } catch (err) {
    next(err);
  }
};
