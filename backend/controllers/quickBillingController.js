const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const {
  calcInvoiceTotals,
  getNextInvoiceNumber,
  logActivity,
  getSettings,
  bankersRound,
} = require('../utils/helpers');
const { updateStock } = require('../utils/stockService');

// ─── POST /api/quick-billing ────────────────────────────────────────────────
// Creates a real Invoice record using the same helpers as createSale,
// but without the minimum-order guard and with auto-upsert of walk-in customers.
exports.createQuickBill = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      customerName,
      phone,
      items,          // [{ productId, qty, unitPrice }]
      discountType,   // 'flat' | 'percent'
      discountValue,  // number
    } = req.body;

    // ── 1. Validate ──────────────────────────────────────────────────────────
    if (!phone || !/^\d{10}$/.test(String(phone).trim())) {
      await t.rollback();
      return res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
    }
    if (!items || !items.length || items.every((i) => Number(i.qty) <= 0)) {
      await t.rollback();
      return res.status(400).json({ message: 'At least one item with quantity > 0 is required.' });
    }

    // ── 2. Auto-upsert walk-in customer by phone ─────────────────────────────
    const resolvedName = (customerName || '').trim() || 'Walk-in Customer';
    const [customerRecord] = await Customer.findOrCreate({
      where: { phone: String(phone).trim() },
      defaults: {
        name: resolvedName,
        phone: String(phone).trim(),
        customerType: 'Retail Shop',
        status: 'Active',
      },
      transaction: t,
    });

    // Update name if provided and it differs from the stored one
    if (
      customerName &&
      customerName.trim() &&
      customerRecord.name === 'Walk-in Customer' &&
      customerName.trim() !== 'Walk-in Customer'
    ) {
      customerRecord.name = customerName.trim();
      await customerRecord.save({ transaction: t });
    }

    // ── 3. Enrich items ───────────────────────────────────────────────────────
    //    CRITICAL: filter products on isActive + isArchived only — NOT isPublished
    const enrichedItems = [];
    for (const item of items) {
      const qty = Number(item.qty);
      if (qty <= 0) continue;

      const product = await Product.findOne({
        where: { id: item.productId, isActive: true, isArchived: false },
        transaction: t,
      });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `Product not found or unavailable (id: ${item.productId}).` });
      }

      const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sellingPrice);
      const lineTotal = bankersRound(qty * unitPrice);

      enrichedItems.push({
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        gstPercent: Number(product.gstPercent || 0),
        lineTotal,
        purchasePrice: Number(product.purchasePrice || 0),
        dispatchedQty: qty,
        pendingQty: 0,
        freeQty: 0,
        schemeApplied: 'None',
        offerCost: 0,
        actualProfit: qty * unitPrice - qty * Number(product.purchasePrice || 0),
      });
    }

    // ── 4. Compute discount ───────────────────────────────────────────────────
    const subtotalRaw = enrichedItems.reduce((s, i) => s + i.lineTotal, 0);
    let discountAmount = 0;
    if (discountValue && Number(discountValue) > 0) {
      if (discountType === 'percent') {
        discountAmount = bankersRound((Number(discountValue) / 100) * subtotalRaw);
      } else {
        discountAmount = bankersRound(Number(discountValue));
      }
    }
    discountAmount = Math.max(0, Math.min(discountAmount, subtotalRaw));

    // ── 5. Calculate totals (no GST for stall, no shipping) ──────────────────
    const totals = calcInvoiceTotals(enrichedItems, discountAmount, 'no_gst', {});

    // ── 6. Generate invoice number ────────────────────────────────────────────
    const invoiceNumber = await getNextInvoiceNumber({ transaction: t });

    // ── 7. Create Invoice ─────────────────────────────────────────────────────
    const sale = await Invoice.create(
      {
        invoiceNumber,
        customerId: customerRecord.id,
        date: new Date(),
        dueDate: new Date(),
        subtotal: totals.subtotal,
        discount: discountAmount,
        gstTotal: 0,
        grandTotal: totals.grandTotal,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        amountPaid: totals.grandTotal,
        customerType: 'Retail Shop',
        salesChannel: 'Retail Shop',
        createdById: req.user.id,
        status: 'Confirmed',
        gstBillingMode: 'no_gst',
        invoiceType: 'NON_GST',
        gstMode: 'None',
        gstApplicable: false,
        isGSTReportable: false,
        shippingCharge: 0,
        packingCharge: 0,
        handlingCharge: 0,
        courierCharge: 0,
        otherCharge: 0,
        roundOff: totals.roundOff,
        taxableValue: totals.subtotal,
        // Tag for easy dashboard filtering
        commitment: 'Quick Bill',
      },
      { transaction: t }
    );

    // ── 8. Create InvoiceItems ────────────────────────────────────────────────
    for (const item of enrichedItems) {
      await InvoiceItem.create(
        {
          invoiceId: sale.id,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          freeQty: 0,
          schemeApplied: 'None',
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
          purchasePrice: item.purchasePrice,
          dispatchedQty: item.qty,
          pendingQty: 0,
          offerCost: 0,
          actualProfit: item.actualProfit,
        },
        { transaction: t }
      );
    }

    // ── 9. Decrement stock via the same updateStock used by createSale ────────
    for (const item of enrichedItems) {
      await updateStock(item.productId, -item.qty, {
        type: 'sale',
        referenceId: sale.id,
        referenceModel: 'Invoice',
        userId: req.user.id,
        transaction: t,
      });
    }

    await t.commit();
    await logActivity(req.user.id, 'create', 'quick-billing', `Quick bill ${invoiceNumber} created`);

    // ── 10. Return populated sale ─────────────────────────────────────────────
    const populated = await Invoice.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        {
          model: InvoiceItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit'] }],
        },
      ],
    });

    res.status(201).json({ sale: populated });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ─── GET /api/quick-billing/stats ────────────────────────────────────────────
// Returns today's totals and recent bills, querying the real Invoice table.
// Supports optional ?search= for the "Search Invoice" box.
exports.getQuickBillingStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const search = (req.query.search || '').trim();

    // Today's aggregate stats (all Retail Shop sales today, not just quick bills)
    const [stats] = await Invoice.findAll({
      where: {
        salesChannel: 'Retail Shop',
        status: { [Op.ne]: 'Cancelled' },
        date: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
      attributes: [
        [Invoice.sequelize.fn('COUNT', Invoice.sequelize.col('Invoice.id')), 'billCount'],
        [Invoice.sequelize.fn('SUM', Invoice.sequelize.col('grandTotal')), 'totalSales'],
        [Invoice.sequelize.fn('SUM', Invoice.sequelize.col('discount')), 'totalDiscount'],
      ],
      raw: true,
    });

    // Recent bills query — searchable by invoice number, customer name, or phone
    const recentWhere = {
      salesChannel: 'Retail Shop',
      status: { [Op.ne]: 'Cancelled' },
    };

    if (search) {
      recentWhere[Op.or] = [
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { '$customer.name$': { [Op.like]: `%${search}%` } },
        { '$customer.phone$': { [Op.like]: `%${search}%` } },
      ];
    }

    const recentBills = await Invoice.findAll({
      where: recentWhere,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        {
          model: InvoiceItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: search ? 50 : 20,
      subQuery: false,
    });

    res.json({
      totalSales: Number(stats?.totalSales || 0),
      billCount: Number(stats?.billCount || 0),
      totalDiscount: Number(stats?.totalDiscount || 0),
      recentBills,
    });
  } catch (err) {
    next(err);
  }
};
