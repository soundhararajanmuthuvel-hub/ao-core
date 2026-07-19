const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const User = require('../models/User');
const Shipment = require('../models/Shipment');
const { calcInvoiceTotals, getNextInvoiceNumber, logActivity, getSettings, createNotification } = require('../utils/helpers');
const { updateStock } = require('../utils/stockService');
const { isValidGstin, getStateCodeByName } = require('../utils/gst');

exports.getSales = async (req, res, next) => {
  try {
    // Deferred global invoice reconciliation to manual endpoint to prevent DB connection locks
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    // Automatically create overdue alerts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = await Invoice.findAll({
      where: {
        type: 'invoice',
        paymentStatus: { [Op.ne]: 'paid' },
        status: { [Op.ne]: 'Cancelled' },
        dueDate: { [Op.lt]: today }
      },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'customerCode'] }]
    });

    const Notification = require('../models/Notification');
    const { createNotification } = require('../utils/helpers');

    for (const inv of overdueInvoices) {
      if (!inv.dueDate || !inv.customer) continue;
      const overdueDays = Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
      if (overdueDays > 0) {
        const titleText = `Overdue Alert: ${inv.invoiceNumber}`;
        const existing = await Notification.findOne({
          where: { title: titleText }
        });
        if (!existing) {
          const messageText = `Customer: ${inv.customer.name}\nAmount: ₹${Number(inv.grandTotal).toLocaleString('en-IN')}\nOverdue by ${overdueDays} Days`;
          await createNotification({
            title: titleText,
            message: messageText,
            type: 'warning',
            link: `/sales/${inv.id}`
          });
        }
      }
    }
    
    const query = {};
    if (req.query.status) query.paymentStatus = req.query.status;
    if (req.query.erpStatus) query.status = req.query.erpStatus;
    if (search) {
      query[Op.or] = [
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { '$customer.name$': { [Op.like]: `%${search}%` } },
        { '$customer.phone$': { [Op.like]: `%${search}%` } },
        { '$customer.gstNumber$': { [Op.like]: `%${search}%` } }
      ];
    }

    const include = [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'gstNumber', 'balance', 'creditLimit', 'paymentTerms', 'paymentCycle', 'creditDays', 'businessName', 'customerType', 'address', 'state', 'pincode', 'customerCode'] },
      { model: User, as: 'createdBy', attributes: ['name'] },
      { model: Shipment, as: 'shipments', attributes: ['id', 'shipmentNumber', 'status', 'trackingNumber'] }
    ];

    if (req.query.includeItems) {
      include.push({
        model: InvoiceItem,
        as: 'items',
        include: [{ model: Product, as: 'product', attributes: ['name', 'sku', 'unit', 'sellingPrice'] }]
      });
    }

    const { count: total, rows: sales } = await Invoice.findAndCountAll({
      where: query,
      include: include,
      order: [['date', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
      subQuery: false
    });

    res.json({ sales, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getSale = async (req, res, next) => {
  try {
    // Deferred global invoice reconciliation to manual endpoint to prevent DB connection locks
    const sale = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'createdBy', attributes: ['name'] },
        { model: Shipment, as: 'shipments' },
        {
          model: InvoiceItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }],
        },
      ],
    });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    const settings = await getSettings();
    res.json({ sale, settings });
  } catch (err) {
    next(err);
  }
};

exports.createSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { customer, items, discount = 0, paymentMethod, paymentStatus, amountPaid, date } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Items required' });

    const customerRecord = await Customer.findByPk(customer, { transaction: t });
    if (!customerRecord) throw new Error('Customer not found');

    const customerType = customerRecord.customerType || 'Retail Shop';

    // 1. Load settings to determine WooCommerce, Shipping, and GST rules
    const settings = await getSettings({ transaction: t });

    // 2. Resolve GST details and Validate GST properties
    const customerGst = (customerRecord.gstNumber || '').trim().toUpperCase();
    const invoiceType = customerGst ? 'GST' : 'NON_GST';

    let gstBillingMode = customerRecord.gstBillingMode;
    if (!gstBillingMode || gstBillingMode === 'default') {
      if (customerType === 'White Label') {
        gstBillingMode = 'exclusive';
      } else if (customerType === 'D2C Customer') {
        gstBillingMode = 'inclusive';
      } else if (customerType === 'Export Customer') {
        gstBillingMode = 'no_gst';
      } else {
        gstBillingMode = settings.defaultGstMode || 'exclusive';
      }
    }
    if (req.body.gstBillingMode) {
      gstBillingMode = req.body.gstBillingMode;
    }

    let gstMode = 'None';
    if (invoiceType === 'GST') {
      // Validate customer GSTIN
      if (!isValidGstin(customerGst)) {
        throw new Error(`Invalid Customer GSTIN format: ${customerGst}. Must be 15 characters conforming to Indian GSTIN standards.`);
      }

      // Validate matching state code
      const customerGstStateCode = customerGst.slice(0, 2);
      const expectedStateCode = getStateCodeByName(customerRecord.state);
      if (expectedStateCode && customerGstStateCode !== expectedStateCode) {
        throw new Error(`Customer GSTIN state code prefix (${customerGstStateCode}) does not match the customer's state (${customerRecord.state}, code: ${expectedStateCode}).`);
      }

      gstMode = (gstBillingMode === 'inclusive') ? 'Inclusive' : 'Exclusive';
    } else {
      gstMode = 'None';
      gstBillingMode = 'no_gst'; // force no_gst calculation for Non-GST customers
    }

    const specialPricing = customerRecord.specialPricing || {};

    // 3. Enrich Items and calculate weight
    let totalWeight = 0;
    const enrichedItems = [];
    for (const item of items) {
      const product = await Product.findByPk(item.product, { transaction: t });
      if (!product) throw new Error(`Product not found: ${item.product}`);

      // If GST invoice, validate HSN (gstClass) and positive GST percentage
      if (invoiceType === 'GST') {
        const hsnCode = String(product.gstClass || '').trim();
        if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(hsnCode)) {
          throw new Error(`Product ${product.name} must have a valid 4, 6, or 8 digit numeric HSN Code (got "${hsnCode}").`);
        }
        const itemGstPercent = Number(item.gstPercent) || Number(product.gstPercent || 0);
        if (itemGstPercent <= 0) {
          throw new Error(`GST percentage for product ${product.name} must be a positive number (got ${itemGstPercent}%).`);
        }
      }

      const stockAvailable = Number(product.stock || 0);
      const requestedQty = Number(item.qty);

      // Tier pricing extraction
      let tierPrice = product.sellingPrice;
      if (customerRecord.tier === 'GREEN' && Number(product.greenPrice) > 0) {
        tierPrice = product.greenPrice;
      } else if (customerRecord.tier === 'YELLOW' && Number(product.yellowPrice) > 0) {
        tierPrice = product.yellowPrice;
      } else if (customerRecord.tier === 'RED' && Number(product.redPrice) > 0) {
        tierPrice = product.redPrice;
      }

      // Customer Special Pricing / Discount / Scheme Override
      const productOverride = specialPricing[product.id] || specialPricing[product.sku] || null;
      let basePrice = Number(tierPrice);

      if (req.user.role === 'Salesman' || req.user.role === 'Sales Executive') {
        basePrice = Number(tierPrice); // Salesman cannot edit prices
      } else if (item.unitPrice !== undefined) {
        basePrice = Number(item.unitPrice);
      }

      let itemDiscountPercent = Number(item.discountPercent || 0);
      let schemeApplied = item.schemeApplied || 'None';

      if (productOverride) {
        if (typeof productOverride === 'object') {
          if (productOverride.price !== undefined && productOverride.price !== null && productOverride.price !== '') {
            basePrice = Number(productOverride.price);
          }
          if (productOverride.discount !== undefined && productOverride.discount !== null && productOverride.discount !== '') {
            itemDiscountPercent = Number(productOverride.discount);
          }
          if (productOverride.scheme !== undefined && productOverride.scheme !== null && productOverride.scheme !== '') {
            schemeApplied = productOverride.scheme;
          }
        } else if (typeof productOverride === 'number') {
          basePrice = productOverride;
        }
      }

      // Calculate free quantity based on scheme (e.g. 10+1, 20+2, 50+5)
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(requestedQty / buyQty) * getQty;
      }

      const totalRequestedQty = requestedQty + freeQty;
      const dispatchedQty = Math.max(0, Math.min(stockAvailable, totalRequestedQty));
      const pendingQty = Math.max(0, totalRequestedQty - dispatchedQty);
      
      totalWeight += totalRequestedQty * Number(product.weight || 0.200);

      // Net unit price after item discount
      const netUnitPrice = basePrice * (1 - itemDiscountPercent / 100);

      let lineTotal = 0;
      const itemGstPercent = Number(item.gstPercent) || Number(product.gstPercent || 0);

      if (gstBillingMode === 'inclusive') {
        lineTotal = requestedQty * netUnitPrice;
      } else if (gstBillingMode === 'no_gst') {
        lineTotal = requestedQty * netUnitPrice;
      } else { // exclusive
        lineTotal = requestedQty * netUnitPrice * (1 + itemGstPercent / 100);
      }

      // Record offerCost = freeQty * purchasePrice and actualProfit = (qty * unitPrice) - ((qty + freeQty) * purchasePrice)
      const offerCost = freeQty * Number(product.purchasePrice || 0);
      const actualProfit = (requestedQty * netUnitPrice) - (totalRequestedQty * Number(product.purchasePrice || 0));

      enrichedItems.push({
        productId: product.id,
        name: product.name,
        qty: requestedQty,
        freeQty,
        schemeApplied,
        unitPrice: netUnitPrice,
        gstPercent: itemGstPercent,
        lineTotal,
        purchasePrice: Number(product.purchasePrice),
        dispatchedQty,
        pendingQty,
        offerCost,
        actualProfit,
      });
    }

    // 4. Calculate Shipping Charge and Logistics Costs
    const packingCost = Number(settings.packingCost || 0);
    const handlingCost = Number(settings.handlingCost || 0);
    const loadingCost = Number(settings.loadingCost || 0);
    
    let courierCost = Number(settings.courierCost || 0);
    if (settings.shippingMode === 'fixed') {
      courierCost = Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'weight') {
      let weightRules = [];
      try {
        weightRules = JSON.parse(settings.shippingWeightRules || '[]');
      } catch (e) {}
      const weightGrams = totalWeight * 1000;
      const rule = weightRules.find(r => weightGrams >= r.min && weightGrams <= r.max);
      courierCost = rule ? Number(rule.charge) : Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'zone') {
      const stateStr = (customerRecord.state || '').toLowerCase().trim();
      let zone = 'rest_of_india';
      if (['tamil nadu', 'tamilnadu', 'tn'].includes(stateStr)) {
        zone = 'tamil_nadu';
      } else if (['kerala', 'karnataka', 'andhra pradesh', 'andhrapradesh', 'ap', 'telangana', 'puducherry', 'pondicherry', 'lakshadweep'].includes(stateStr)) {
        zone = 'south_india';
      }
      const zoneRates = JSON.parse(settings.shippingZoneRates || '{"tamil_nadu":50,"south_india":80,"rest_of_india":120}');
      const ratePerKg = Number(zoneRates[zone] || 120);
      const courierWeight = totalWeight <= 1.0 ? 1.5 : totalWeight;
      courierCost = courierWeight * ratePerKg;
    } else if (settings.shippingMode === 'value') {
      let tempSubtotal = 0;
      for (const item of enrichedItems) {
        tempSubtotal += Number(item.qty || 0) * Number(item.unitPrice || 0);
      }
      if (tempSubtotal >= Number(settings.shippingValueThreshold || 999)) {
        courierCost = Number(settings.shippingValueAboveCharge || 0);
      } else {
        courierCost = Number(settings.shippingValueBelowCharge || 80);
      }
    }

    let shippingCharge = 0;
    if (req.body.shippingCharge !== undefined && req.body.shippingCharge !== null) {
      shippingCharge = Number(req.body.shippingCharge);
    } else {
      if (settings.shippingMode === 'included' || settings.shippingMode === 'free') {
        shippingCharge = 0;
      } else {
        if (settings.mergeShippingCharges) {
          shippingCharge = packingCost + handlingCost + courierCost + loadingCost;
        } else {
          shippingCharge = courierCost;
        }
      }
    }

    const charges = {
      shippingCharge,
      packingCharge: settings.mergeShippingCharges ? 0 : Number(req.body.packingCharge || 0),
      handlingCharge: settings.mergeShippingCharges ? 0 : Number(req.body.handlingCharge || 0),
      courierCharge: settings.mergeShippingCharges ? 0 : Number(req.body.courierCharge || 0),
      otherCharge: settings.mergeShippingCharges ? 0 : Number(req.body.otherCharge || 0),
    };

    let resolvedChannel = req.body.salesChannel;
    if (!resolvedChannel) {
      if (customerType === 'White Label') resolvedChannel = 'White Label';
      else if (customerType === 'Organic Store') resolvedChannel = 'Organic Store';
      else if (customerType === 'Retail Shop') resolvedChannel = 'Retail Shop';
      else if (customerType === 'D2C Customer') resolvedChannel = 'D2C';
      else if (customerType === 'Distributor') resolvedChannel = 'Distributor';
      else if (customerType === 'Wholesaler') resolvedChannel = 'Wholesale';
      else resolvedChannel = 'Retail Shop';
    }

    const totals = calcInvoiceTotals(enrichedItems, discount, gstBillingMode, charges);

    // Minimum Order Validation
    const minGreen = Number(settings.minOrderGreen !== undefined ? settings.minOrderGreen : 10000.00);
    const minYellow = Number(settings.minOrderYellow !== undefined ? settings.minOrderYellow : 5000.00);
    const minRed = Number(settings.minOrderRed !== undefined ? settings.minOrderRed : 2000.00);
    let requiredMin = minRed;
    if (customerRecord.tier === 'GREEN') requiredMin = minGreen;
    else if (customerRecord.tier === 'YELLOW') requiredMin = minYellow;

    if (totals.grandTotal < requiredMin) {
      if (req.user.role !== 'Super Admin' && req.user.role !== 'admin') {
        throw new Error(`Invoice grand total (₹${totals.grandTotal.toFixed(2)}) is below the minimum required amount (₹${requiredMin.toFixed(2)}) for ${customerRecord.tier || 'RED'} Tier customers. Submission blocked.`);
      }
    }

    const invoiceNumber = await getNextInvoiceNumber({ transaction: t });

    const hasPendingItems = enrichedItems.some(item => item.pendingQty > 0);
    const resolvedStatus = hasPendingItems ? 'Waiting For Stock' : (req.body.status || 'Confirmed');

    // Same-Day Delivery Cutoff Logic
    const cutoffHour = settings.sameDayCutoffHour !== undefined ? settings.sameDayCutoffHour : 13;
    const currentHour = new Date().getHours();
    const resolvedCommitment = currentHour < cutoffHour ? 'Same Day' : 'Next Day';

    let expectedDispatchDate = req.body.expectedDispatchDate;
    let commitment = req.body.commitment || (resolvedStatus === 'Waiting For Stock' ? 'Within 3 Days' : resolvedCommitment);

    if (!expectedDispatchDate) {
      const baseDate = date ? new Date(date) : new Date();
      if (resolvedStatus === 'Waiting For Stock') {
        baseDate.setDate(baseDate.getDate() + 3);
      } else if (commitment === 'Next Day') {
        baseDate.setDate(baseDate.getDate() + 1);
      }
      expectedDispatchDate = baseDate;
    }

    // Auto-calculate dueDate based on paymentTerms
    let days = 0;
    const terms = customerRecord.paymentTerms || 'COD';
    if (terms.startsWith('Net ')) {
      const match = terms.match(/Net (\d+)/);
      if (match) {
        days = parseInt(match[1], 10);
      }
    }
    const invoiceDate = date ? new Date(date) : new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);

    // Calculate Indian GST parameters
    const companyGSTIN = (settings.gstNumber || '').trim().toUpperCase();
    const companyStateCode = (settings.stateCode || companyGSTIN.slice(0, 2)).trim().padStart(2, '0');
    const customerGSTIN = customerGst;
    const customerStateCode = customerGSTIN.slice(0, 2);
    const isIntraState = (invoiceType === 'GST' && companyStateCode && customerStateCode && companyStateCode === customerStateCode);

    let invoiceTaxableAmount = 0;
    let invoiceTotalGST = 0;
    let invoiceCgstAmount = 0;
    let invoiceSgstAmount = 0;
    let invoiceIgstAmount = 0;
    let hsnSummaryString = null;

    if (invoiceType === 'GST') {
      const summaryMap = {};
      for (const item of enrichedItems) {
        const prod = item.productId ? await Product.findByPk(item.productId, { transaction: t }) : null;
        const hsn = (prod && prod.gstClass) ? String(prod.gstClass).trim() : '0000';
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const gstPercent = Number(item.gstPercent || 0);
        
        let taxable = 0;
        let gst = 0;
        if (gstBillingMode === 'inclusive') {
          const lineTotal = qty * unitPrice;
          taxable = lineTotal / (1 + gstPercent / 100);
          gst = lineTotal - taxable;
        } else if (gstBillingMode === 'no_gst') {
          taxable = qty * unitPrice;
          gst = 0;
        } else { // exclusive
          taxable = qty * unitPrice;
          gst = (taxable * gstPercent) / 100;
        }
        
        if (!summaryMap[hsn]) {
          summaryMap[hsn] = {
            hsn,
            taxable: 0,
            gstRate: gstPercent,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalGst: 0
          };
        }
        
        summaryMap[hsn].taxable += taxable;
        summaryMap[hsn].totalGst += gst;
      }
      
      const hsnList = Object.values(summaryMap).map(hsnItem => {
        hsnItem.taxable = Number(hsnItem.taxable.toFixed(2));
        hsnItem.totalGst = Number(hsnItem.totalGst.toFixed(2));
        if (isIntraState) {
          hsnItem.cgst = Number((hsnItem.totalGst / 2).toFixed(2));
          hsnItem.sgst = Number((hsnItem.totalGst / 2).toFixed(2));
          hsnItem.igst = 0;
        } else {
          hsnItem.cgst = 0;
          hsnItem.sgst = 0;
          hsnItem.igst = hsnItem.totalGst;
        }
        return hsnItem;
      });
      
      hsnSummaryString = JSON.stringify(hsnList);
      invoiceTaxableAmount = Number(hsnList.reduce((sum, h) => sum + h.taxable, 0).toFixed(2));
      invoiceTotalGST = Number(hsnList.reduce((sum, h) => sum + h.totalGst, 0).toFixed(2));
      
      if (isIntraState) {
        invoiceCgstAmount = Number((invoiceTotalGST / 2).toFixed(2));
        invoiceSgstAmount = Number((invoiceTotalGST / 2).toFixed(2));
        invoiceIgstAmount = 0;
      } else {
        invoiceCgstAmount = 0;
        invoiceSgstAmount = 0;
        invoiceIgstAmount = invoiceTotalGST;
      }
    }

    const sale = await Invoice.create(
      {
        invoiceNumber,
        customerId: customer,
        date: invoiceDate,
        dueDate,
        subtotal: totals.subtotal,
        discount: Number(discount),
        gstTotal: totals.gstTotal,
        grandTotal: totals.grandTotal,
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus || 'paid',
        amountPaid: amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : totals.grandTotal,
        customerType,
        salesChannel: resolvedChannel,
        createdById: req.user.id,
        status: resolvedStatus,
        expectedDispatchDate,
        commitment,
        gstBillingMode,
        shippingCharge: totals.shippingCharge,
        packingCharge: totals.packingCharge,
        handlingCharge: totals.handlingCharge,
        courierCharge: totals.courierCharge,
        otherCharge: totals.otherCharge,
        packingCost,
        handlingCost,
        courierCost,
        loadingCost,
        roundOff: totals.roundOff,
        taxableValue: totals.subtotal,
        wooOrderId: req.body.wooOrderId || null,
        invoiceType,
        gstMode,
        sellerGSTIN: invoiceType === 'GST' ? (settings.gstNumber || null) : null,
        customerGSTIN: invoiceType === 'GST' ? (customerGst || null) : null,
        placeOfSupply: invoiceType === 'GST' ? (customerRecord.state || null) : null,
        gstApplicable: invoiceType === 'GST',
        isGSTReportable: invoiceType === 'GST',
        isGSTPortalExported: false,
        hsnSummary: hsnSummaryString,
        taxableAmount: invoiceTaxableAmount,
        cgstAmount: invoiceCgstAmount,
        sgstAmount: invoiceSgstAmount,
        igstAmount: invoiceIgstAmount,
        totalGST: invoiceTotalGST,
      },
      { transaction: t }
    );


    for (const item of enrichedItems) {
      await InvoiceItem.create(
        {
          invoiceId: sale.id,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          freeQty: item.freeQty,
          schemeApplied: item.schemeApplied,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
          purchasePrice: item.purchasePrice,
          dispatchedQty: item.dispatchedQty,
          pendingQty: item.pendingQty,
          offerCost: item.offerCost,
          actualProfit: item.actualProfit,
        },
        { transaction: t }
      );
    }

    for (const item of enrichedItems) {
      if (item.dispatchedQty > 0) {
        await updateStock(item.productId, -item.dispatchedQty, {
          type: 'sale',
          referenceId: sale.id,
          referenceModel: 'Invoice',
          userId: req.user.id,
          transaction: t,
        });
      }
    }

    if (paymentStatus === 'pending' || paymentStatus === 'partial') {
      const pending = totals.grandTotal - (amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : 0);
      customerRecord.balance = Number(customerRecord.balance) + pending;
      await customerRecord.save({ transaction: t });
    }

    // WhatsApp/SMS notification simulation for backorders
    if (resolvedStatus === 'Waiting For Stock') {
      const formattedDate = new Date(expectedDispatchDate).toLocaleDateString();
      console.log(`[Notification Sim] WhatsApp/SMS sent to ${customerRecord.phone || 'customer'}: "Dear ${customerRecord.name}, your order ${invoiceNumber} is confirmed. Some items are currently backordered. Expected dispatch: ${formattedDate} (${commitment})."`);
      await createNotification({
        title: 'Backorder Confirmed',
        message: `Order ${invoiceNumber} for ${customerRecord.name} is backordered. Expected dispatch: ${commitment}.`,
        type: 'warning',
        link: `/sales/${sale.id}`,
        user: req.user.id,
      }, { transaction: t });
    }

    await t.commit();
    await logActivity(req.user.id, 'create', 'sales', `Created invoice ${invoiceNumber}`);
    
    const populated = await Invoice.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['name', 'phone', 'email', 'customerCode'] },
      ],
    });
    res.status(201).json({ sale: populated });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};



exports.deleteSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const Order = require('../models/Order');
    const sale = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });
    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Restore product stock
    for (const item of sale.items) {
      const restoreQty = Number(item.dispatchedQty !== undefined ? item.dispatchedQty : item.qty);
      if (restoreQty > 0) {
        await updateStock(item.productId, restoreQty, {
          type: 'adjustment',
          referenceId: sale.id,
          referenceModel: 'Invoice',
          notes: 'Sale deleted - stock restored',
          userId: req.user.id,
          transaction: t,
        });
      }
    }

    // Disassociate invoice from any orders
    await Order.update(
      { invoiceId: null },
      { where: { invoiceId: sale.id }, transaction: t }
    );

    // Manually delete shipments associated with this invoice to avoid SQLite foreign key constraints
    await Shipment.destroy({
      where: { invoiceId: sale.id },
      transaction: t
    });

    // Manually delete items associated with this invoice
    await InvoiceItem.destroy({
      where: { invoiceId: sale.id },
      transaction: t
    });
    
    // Delete the invoice itself
    await sale.destroy({ transaction: t });

    // Recompute customer outstanding balance if deleted document is an active customer invoice
    if (sale.type === 'invoice' && sale.status !== 'Cancelled' && sale.customerId) {
      const customerRecord = await Customer.findByPk(sale.customerId, { transaction: t });
      if (customerRecord) {
        const remainingInvoices = await Invoice.findAll({
          where: {
            customerId: sale.customerId,
            status: { [Op.ne]: 'Cancelled' },
            type: 'invoice'
          },
          transaction: t
        });

        let totalOutstanding = 0;
        let outstandingCount = 0;
        for (const inv of remainingInvoices) {
          const outstanding = Number((inv.grandTotal - inv.amountPaid).toFixed(2));
          if (outstanding > 0) {
            totalOutstanding += outstanding;
            outstandingCount++;
          }
        }

        await customerRecord.update({
          balance: totalOutstanding,
          invoiceOutstandingCount: outstandingCount
        }, { transaction: t });
      }
    }

    await t.commit();
    await logActivity(req.user.id, 'delete', 'sales', `Deleted invoice ${sale.invoiceNumber}`);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getOutstandingInvoices = async (req, res, next) => {
  try {
    await exports.reconcileInvoicesHelper();
    const { Op } = require('sequelize');
    const Invoice = require('../models/Invoice');
    const Customer = require('../models/Customer');

    const query = {
      status: { [Op.ne]: 'Cancelled' },
      grandTotal: { [Op.gt]: sequelize.col('amountPaid') }
    };

    if (req.query?.customerId) {
      query.customerId = req.query.customerId;
    }

    const outstanding = await Invoice.findAll({
      where: query,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'paymentTerms', 'customerCode'] }
      ],
      order: [['date', 'ASC']]
    });

    const results = outstanding.map(inv => {
      const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      due.setHours(0,0,0,0);
      const diffTime = today - due;
      const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        dueDate: inv.dueDate,
        grandTotal: Number(inv.grandTotal),
        amountPaid: Number(inv.amountPaid),
        balance: Number(balance.toFixed(2)),
        daysOverdue,
        customer: inv.customer
      };
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
};

exports.getWhatsAppReminder = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');
    const Customer = require('../models/Customer');

    const sale = await Invoice.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!sale) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp reminder could not be generated.\n\nReason:\nInvoice not found."
      });
    }

    if (!sale.customer) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp reminder could not be generated.\n\nReason:\nCustomer record does not exist."
      });
    }

    let rawPhone = sale.customer.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp reminder could not be generated.\n\nReason:\nCustomer phone number is missing."
      });
    }

    const balance = Number(sale.grandTotal) - Number(sale.amountPaid);
    if (balance <= 0) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp reminder could not be generated.\n\nReason:\nNo unpaid invoices available."
      });
    }

    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const customerName = sale.customer.name || 'Customer';

    const messageText = `Dear ${customerName},\n\nInvoice ${sale.invoiceNumber}\nAmount ₹${balance.toLocaleString('en-IN')}\nis pending for payment.\n\nKindly arrange payment.\n\nThank you,\nAmudhasurabiy Organics`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    res.json({
      success: true,
      messageText,
      whatsappUrl
    });
  } catch (err) {
    next(err);
  }
};

exports.recordPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { customerId, amount, paymentMethod, referenceNumber, allocations } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }
    if (!allocations || !allocations.length) {
      return res.status(400).json({ message: 'At least one invoice allocation is required' });
    }

    const customerRecord = await Customer.findByPk(customerId, { transaction: t });
    if (!customerRecord) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    let totalAllocated = 0;
    let totalDelayDays = 0;
    let closedInvoicesCount = 0;

    for (const alloc of allocations) {
      const invoice = await Invoice.findByPk(alloc.invoiceId, { transaction: t });
      if (!invoice) {
        throw new Error(`Invoice ID ${alloc.invoiceId} not found`);
      }

      const allocAmt = Number(alloc.amount || 0);
      if (allocAmt <= 0) continue;

      totalAllocated += allocAmt;
      const currentPaid = Number(invoice.amountPaid || 0);
      const newPaid = Number((currentPaid + allocAmt).toFixed(2));
      const grandTotal = Number(invoice.grandTotal || 0);

      invoice.amountPaid = newPaid;
      if (newPaid >= grandTotal) {
        invoice.paymentStatus = 'paid';
        
        // Calculate payment delay in days from invoice date
        const delay = Math.floor((new Date() - new Date(invoice.date)) / (1000 * 60 * 60 * 24));
        totalDelayDays += Math.max(0, delay);
        closedInvoicesCount++;
      } else {
        invoice.paymentStatus = 'partial';
      }

      // Update invoice payment details
      invoice.paymentMethod = paymentMethod || 'cash';
      await invoice.save({ transaction: t });
    }

    // Adjust customer outstanding balance
    const currentBalance = Number(customerRecord.balance || 0);
    customerRecord.balance = Number(Math.max(0, currentBalance - totalAllocated).toFixed(2));
    customerRecord.lastPaymentDate = new Date();

    // Recalculate average payment days if any invoices were fully closed in this payment
    if (closedInvoicesCount > 0) {
      const avgDelay = Math.round(totalDelayDays / closedInvoicesCount);
      const currentAvg = Number(customerRecord.averagePaymentDays || 0);
      customerRecord.averagePaymentDays = currentAvg > 0 
        ? Math.round((currentAvg * 4 + avgDelay) / 5) 
        : avgDelay;
    }

    // Recompute outstanding invoice count
    const pendingCount = await Invoice.count({
      where: {
        customerId,
        status: { [Op.ne]: 'Cancelled' },
        paymentStatus: { [Op.ne]: 'paid' }
      },
      transaction: t
    });
    customerRecord.invoiceOutstandingCount = pendingCount;

    await customerRecord.save({ transaction: t });

    const Payment = require('../models/Payment');
    const { getNextPaymentNumber } = require('../utils/helpers');
    const paymentNumber = await getNextPaymentNumber({ transaction: t });

    await Payment.create({
      paymentNumber,
      customerId,
      date: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      amount: totalAllocated,
      paymentMethod: paymentMethod || 'upi',
      referenceNumber: referenceNumber || null,
      allocations: allocations,
      status: 'Success'
    }, { transaction: t });

    // Log activity
    await logActivity(
      req.user.id,
      'create',
      'payments',
      `Recorded payment of ₹${totalAllocated.toFixed(2)} for customer ${customerRecord.name} (Ref: ${referenceNumber || 'N/A'})`
    );

    await t.commit();

    // Trigger Automated WhatsApp Thank You Message
    if (customerRecord.phone) {
      try {
        const whatsappService = require('../services/whatsappService');
        const thankYouMessage = `Dear ${customerRecord.name},\n\nThank you for your payment of ₹${totalAllocated.toFixed(2)}.\n\nReceived Amount: ₹${totalAllocated.toFixed(2)}\nPrevious Balance: ₹${currentBalance.toFixed(2)}\nCurrent Outstanding: ₹${customerRecord.balance.toFixed(2)}\n\nThank you for doing business with us.\nAmudhasurabiy Organics`;
        
        // Dispatched asynchronously in background
        whatsappService.sendMessage(customerRecord.phone, thankYouMessage, customerRecord.id, 'Thank You Message').catch(err => {
          console.error('[Auto Thank You Message] Error sending message:', err.message);
        });
      } catch (err) {
        console.error('[Auto Thank You Message] Failed to trigger send:', err.message);
      }
    }

    res.json({
      message: 'Payment recorded and allocated successfully',
      outstandingBalance: customerRecord.balance,
      invoiceOutstandingCount: customerRecord.invoiceOutstandingCount
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const Payment = require('../models/Payment');
    const Customer = require('../models/Customer');
    
    const query = {};
    if (req.query.customerId) {
      query.customerId = req.query.customerId;
    }
    
    const payments = await Payment.findAll({
      where: query,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'customerType', 'customerCode'] }
      ],
      order: [['date', 'DESC']]
    });
    
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

let lastFullReconcileTime = 0;

exports.reconcileInvoicesHelper = async (customerId = null) => {
  if (!customerId) {
    const now = Date.now();
    if (now - lastFullReconcileTime < 60000) {
      return { throttled: true };
    }
    lastFullReconcileTime = now;
  }

  const Payment = require('../models/Payment');
  const Customer = require('../models/Customer');

  const invoiceQuery = { status: { [Op.notIn]: ['Cancelled', 'Draft'] }, type: 'invoice' };
  if (customerId) {
    invoiceQuery.customerId = customerId;
  }
  const invoices = await Invoice.findAll({ where: invoiceQuery });

  const paymentQuery = { status: 'Success' };
  if (customerId) {
    paymentQuery.customerId = customerId;
  }
  const payments = await Payment.findAll({ where: paymentQuery });

  // Map of invoiceId -> totalPaid
  const paidAmounts = {};
  payments.forEach(p => {
    let allocs = [];
    if (typeof p.allocations === 'string') {
      try { allocs = JSON.parse(p.allocations); } catch (e) {}
    } else if (Array.isArray(p.allocations)) {
      allocs = p.allocations;
    }
    allocs.forEach(alloc => {
      if (alloc.invoiceId) {
        paidAmounts[alloc.invoiceId] = (paidAmounts[alloc.invoiceId] || 0) + Number(alloc.amount || 0);
      }
    });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let scanned = 0;
  let fixed = 0;
  let correct = 0;

  for (const inv of invoices) {
    scanned++;
    const total = Number(inv.grandTotal || 0);
    const paid = Number((paidAmounts[inv.id] || 0).toFixed(2));
    const outstanding = Number((total - paid).toFixed(2));

    let calculatedStatus = 'unpaid';
    if (outstanding <= 0) {
      calculatedStatus = 'paid';
    } else if (paid > 0) {
      calculatedStatus = 'partial';
    } else {
      calculatedStatus = 'unpaid';
    }

    if (calculatedStatus !== 'paid' && inv.dueDate && new Date(inv.dueDate) < today) {
      calculatedStatus = 'overdue';
    }

    // Required Console Debug Log
    console.log(`Invoice ID: ${inv.id} | Total: ${total} | Paid: ${paid} | Outstanding: ${outstanding} | Calculated Status: ${calculatedStatus.toUpperCase()}`);

    if (Number(inv.amountPaid) !== paid || inv.paymentStatus !== calculatedStatus) {
      inv.amountPaid = paid;
      inv.paymentStatus = calculatedStatus;
      await inv.save();
      fixed++;
    } else {
      correct++;
    }
  }

  // Update Customer outstanding balance and outstanding count based on actual payment-allocated invoices
  if (customerId) {
    const customer = await Customer.findByPk(customerId);
    if (customer) {
      const activeInvoices = await Invoice.findAll({
        where: { customerId, status: { [Op.notIn]: ['Cancelled', 'Draft'] }, type: 'invoice' }
      });
      let computedOutstanding = 0;
      let countOutstanding = 0;
      for (const inv of activeInvoices) {
        const invTotal = Number(inv.grandTotal || 0);
        const invPaid = Number((paidAmounts[inv.id] || 0).toFixed(2));
        const bal = Number((invTotal - invPaid).toFixed(2));
        if (bal > 0) {
          computedOutstanding += bal;
          countOutstanding++;
        }
      }
      customer.balance = Number(computedOutstanding.toFixed(2));
      customer.invoiceOutstandingCount = countOutstanding;
      await customer.save();
    }
  } else {
    // Reconcile all customer balances if customerId is null
    const customers = await Customer.findAll();
    for (const customer of customers) {
      const activeInvoices = await Invoice.findAll({
        where: { customerId: customer.id, status: { [Op.notIn]: ['Cancelled', 'Draft'] }, type: 'invoice' }
      });
      let computedOutstanding = 0;
      let countOutstanding = 0;
      for (const inv of activeInvoices) {
        const invTotal = Number(inv.grandTotal || 0);
        const invPaid = Number((paidAmounts[inv.id] || 0).toFixed(2));
        const bal = Number((invTotal - invPaid).toFixed(2));
        if (bal > 0) {
          computedOutstanding += bal;
          countOutstanding++;
        }
      }
      if (Number(customer.balance) !== Number(computedOutstanding.toFixed(2)) || customer.invoiceOutstandingCount !== countOutstanding) {
        customer.balance = Number(computedOutstanding.toFixed(2));
        customer.invoiceOutstandingCount = countOutstanding;
        await customer.save();
      }
    }
  }

  return { scanned, fixed, correct };
};

exports.repairInvoiceStatus = async (req, res, next) => {
  try {
    const report = await exports.reconcileInvoicesHelper();
    res.json({
      success: true,
      message: 'Invoice status reconciliation complete',
      ...report
    });
  } catch (err) {
    next(err);
  }
};

const recomputeCustomerBalance = async (customerId, transaction) => {
  if (!customerId) return;
  const Customer = require('../models/Customer');
  const Invoice = require('../models/Invoice');
  const customerRecord = await Customer.findByPk(customerId, { transaction });
  if (!customerRecord) return;
  
  // Load payments Success to find paidAmounts for outstanding invoices
  const Payment = require('../models/Payment');
  const payments = await Payment.findAll({ where: { status: 'Success', customerId }, transaction });
  
  const paidAmounts = {};
  payments.forEach(p => {
    let allocs = [];
    if (typeof p.allocations === 'string') {
      try { allocs = JSON.parse(p.allocations); } catch (e) {}
    } else if (Array.isArray(p.allocations)) {
      allocs = p.allocations;
    }
    allocs.forEach(alloc => {
      if (alloc.invoiceId) {
        paidAmounts[alloc.invoiceId] = (paidAmounts[alloc.invoiceId] || 0) + Number(alloc.amount || 0);
      }
    });
  });

  const activeInvoices = await Invoice.findAll({
    where: { customerId, status: { [Op.notIn]: ['Cancelled', 'Draft'] }, type: 'invoice' },
    transaction
  });

  let computedOutstanding = 0;
  let countOutstanding = 0;
  for (const inv of activeInvoices) {
    const invTotal = Number(inv.grandTotal || 0);
    const invPaid = Number((paidAmounts[inv.id] || 0).toFixed(2));
    const bal = Number((invTotal - invPaid).toFixed(2));
    if (bal > 0) {
      computedOutstanding += bal;
      countOutstanding++;
    }
  }

  customerRecord.balance = Number(computedOutstanding.toFixed(2));
  customerRecord.invoiceOutstandingCount = countOutstanding;
  await customerRecord.save({ transaction });
};

exports.updateSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sale = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });
    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Lock condition checks
    // 1. Shipment status check
    const activeShipment = await Shipment.findOne({
      where: {
        invoiceId: sale.id,
        [Op.or]: [
          { status: 'Delivered' },
          { courierStatus: 'Delivered' }
        ]
      },
      transaction: t
    });

    if (activeShipment || sale.status === 'Delivered' || sale.status === 'Archived') {
      await t.rollback();
      return res.status(400).json({ message: 'This invoice is locked because delivery has already been completed.' });
    }

    const { customer, items, discount = 0, paymentMethod, paymentStatus, amountPaid, date, dueDate: customDueDate } = req.body;
    if (!items?.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Items required' });
    }

    const customerRecord = await Customer.findByPk(customer || sale.customerId, { transaction: t });
    if (!customerRecord) throw new Error('Customer not found');
    const customerType = customerRecord.customerType || 'Retail Shop';

    // 1. Load settings to determine WooCommerce, Shipping, and GST rules
    const settings = await getSettings({ transaction: t });

    // 2. Resolve GST details and Validate GST properties
    const customerGst = (customerRecord.gstNumber || '').trim().toUpperCase();
    const invoiceType = customerGst ? 'GST' : 'NON_GST';

    let gstBillingMode = customerRecord.gstBillingMode;
    if (!gstBillingMode || gstBillingMode === 'default') {
      if (customerType === 'White Label') {
        gstBillingMode = 'exclusive';
      } else if (customerType === 'D2C Customer') {
        gstBillingMode = 'inclusive';
      } else if (customerType === 'Export Customer') {
        gstBillingMode = 'no_gst';
      } else {
        gstBillingMode = settings.defaultGstMode || 'exclusive';
      }
    }
    if (req.body.gstBillingMode) {
      gstBillingMode = req.body.gstBillingMode;
    }

    let gstMode = 'None';
    if (invoiceType === 'GST') {
      // Validate customer GSTIN
      if (!isValidGstin(customerGst)) {
        throw new Error(`Invalid Customer GSTIN format: ${customerGst}. Must be 15 characters conforming to Indian GSTIN standards.`);
      }

      // Validate matching state code
      const customerGstStateCode = customerGst.slice(0, 2);
      const expectedStateCode = getStateCodeByName(customerRecord.state);
      if (expectedStateCode && customerGstStateCode !== expectedStateCode) {
        throw new Error(`Customer GSTIN state code prefix (${customerGstStateCode}) does not match the customer's state (${customerRecord.state}, code: ${expectedStateCode}).`);
      }

      gstMode = (gstBillingMode === 'inclusive') ? 'Inclusive' : 'Exclusive';
    } else {
      gstMode = 'None';
      gstBillingMode = 'no_gst'; // force no_gst calculation for Non-GST customers
    }

    const specialPricing = customerRecord.specialPricing || {};

    // 3. Restore product stock of old items first
    for (const oldItem of sale.items) {
      const restoreQty = Number(oldItem.dispatchedQty !== undefined ? oldItem.dispatchedQty : oldItem.qty);
      if (oldItem.productId && restoreQty > 0) {
        await updateStock(oldItem.productId, restoreQty, {
          type: 'adjustment',
          referenceId: sale.id,
          referenceModel: 'Invoice',
          notes: 'Sale edit - previous stock restored',
          userId: req.user.id,
          transaction: t,
        });
      }
    }

    // 4. Enrich New Items and calculate weight
    let totalWeight = 0;
    const enrichedItems = [];
    for (const item of items) {
      const product = item.product ? await Product.findByPk(item.product, { transaction: t }) : null;
      
      if (product) {
        // If GST invoice, validate HSN (gstClass) and positive GST percentage
        if (invoiceType === 'GST') {
          const hsnCode = String(product.gstClass || '').trim();
          if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(hsnCode)) {
            throw new Error(`Product ${product.name} must have a valid 4, 6, or 8 digit numeric HSN Code (got "${hsnCode}").`);
          }
          const itemGstPercent = Number(item.gstPercent) || Number(product.gstPercent || 0);
          if (itemGstPercent <= 0) {
            throw new Error(`GST percentage for product ${product.name} must be a positive number (got ${itemGstPercent}%).`);
          }
        }

        const stockAvailable = Number(product.stock || 0);
        const requestedQty = Number(item.qty);

        // Customer Special Pricing / Discount / Scheme Override
        const productOverride = specialPricing[product.id] || specialPricing[product.sku] || null;
        let basePrice = Number(item.unitPrice);
        let itemDiscountPercent = Number(item.discountPercent || 0);
        let schemeApplied = item.schemeApplied || 'None';

        if (productOverride) {
          if (typeof productOverride === 'object') {
            if (productOverride.price !== undefined && productOverride.price !== null && productOverride.price !== '') {
              basePrice = Number(productOverride.price);
            }
            if (productOverride.discount !== undefined && productOverride.discount !== null && productOverride.discount !== '') {
              itemDiscountPercent = Number(productOverride.discount);
            }
            if (productOverride.scheme !== undefined && productOverride.scheme !== null && productOverride.scheme !== '') {
              schemeApplied = productOverride.scheme;
            }
          } else if (typeof productOverride === 'number') {
            basePrice = productOverride;
          }
        }

        // Calculate free quantity based on scheme
        let freeQty = Number(item.freeQty || 0);
        if (!item.freeQty && schemeApplied !== 'None') {
          const schemeRegex = /^(\d+)\+(\d+)$/;
          const matchScheme = schemeApplied.match(schemeRegex);
          if (matchScheme) {
            const buyQty = Number(matchScheme[1]);
            const getQty = Number(matchScheme[2]);
            freeQty = Math.floor(requestedQty / buyQty) * getQty;
          }
        }

        const totalRequestedQty = requestedQty + freeQty;
        const dispatchedQty = Math.max(0, Math.min(stockAvailable, totalRequestedQty));
        const pendingQty = Math.max(0, totalRequestedQty - dispatchedQty);
        
        totalWeight += totalRequestedQty * Number(product.weight || 0.200);

        // Net unit price after item discount
        const netUnitPrice = basePrice * (1 - itemDiscountPercent / 100);

        let lineTotal = 0;
        const itemGstPercent = Number(item.gstPercent) || Number(product.gstPercent || 0);

        if (gstBillingMode === 'inclusive') {
          lineTotal = requestedQty * netUnitPrice;
        } else if (gstBillingMode === 'no_gst') {
          lineTotal = requestedQty * netUnitPrice;
        } else { // exclusive
          lineTotal = requestedQty * netUnitPrice * (1 + itemGstPercent / 100);
        }

        const offerCost = freeQty * Number(product.purchasePrice || 0);
        const actualProfit = (requestedQty * netUnitPrice) - (totalRequestedQty * Number(product.purchasePrice || 0));

        enrichedItems.push({
          productId: product.id,
          name: product.name,
          qty: requestedQty,
          freeQty,
          schemeApplied,
          unitPrice: netUnitPrice,
          gstPercent: itemGstPercent,
          lineTotal,
          purchasePrice: Number(product.purchasePrice),
          dispatchedQty,
          pendingQty,
          offerCost,
          actualProfit,
        });
      } else {
        // Fallback for unlinked products (e.g. shipping line synced as item, or deleted product)
        const requestedQty = Number(item.qty || 1);
        const freeQty = Number(item.freeQty || 0);
        const basePrice = Number(item.unitPrice || 0);
        const itemGstPercent = Number(item.gstPercent || 0);
        let lineTotal = 0;

        if (gstBillingMode === 'inclusive') {
          lineTotal = requestedQty * basePrice;
        } else if (gstBillingMode === 'no_gst') {
          lineTotal = requestedQty * basePrice;
        } else {
          lineTotal = requestedQty * basePrice * (1 + itemGstPercent / 100);
        }

        enrichedItems.push({
          productId: null,
          name: item.name || 'Unlinked Product',
          qty: requestedQty,
          freeQty,
          schemeApplied: item.schemeApplied || 'None',
          unitPrice: basePrice,
          gstPercent: itemGstPercent,
          lineTotal,
          purchasePrice: 0,
          dispatchedQty: 0,
          pendingQty: 0,
          offerCost: 0,
          actualProfit: lineTotal,
        });
      }
    }

    // 5. Calculate Logistics and Shipping Charges
    const packingCost = Number(settings.packingCost || 0);
    const handlingCost = Number(settings.handlingCost || 0);
    const loadingCost = Number(settings.loadingCost || 0);
    
    let courierCost = Number(settings.courierCost || 0);
    if (settings.shippingMode === 'fixed') {
      courierCost = Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'weight') {
      let weightRules = [];
      try {
        weightRules = JSON.parse(settings.shippingWeightRules || '[]');
      } catch (e) {}
      const weightGrams = totalWeight * 1000;
      const rule = weightRules.find(r => weightGrams >= r.min && weightGrams <= r.max);
      courierCost = rule ? Number(rule.charge) : Number(settings.shippingFixedCharge || 0);
    } else if (settings.shippingMode === 'zone') {
      const stateStr = (customerRecord.state || '').toLowerCase().trim();
      let zone = 'rest_of_india';
      if (['tamil nadu', 'tamilnadu', 'tn'].includes(stateStr)) {
        zone = 'tamil_nadu';
      } else if (['kerala', 'karnataka', 'andhra pradesh', 'andhrapradesh', 'ap', 'telangana', 'puducherry', 'pondicherry', 'lakshadweep'].includes(stateStr)) {
        zone = 'south_india';
      }
      const zoneRates = JSON.parse(settings.shippingZoneRates || '{"tamil_nadu":50,"south_india":80,"rest_of_india":120}');
      const ratePerKg = Number(zoneRates[zone] || 120);
      const courierWeight = totalWeight <= 1.0 ? 1.5 : totalWeight;
      courierCost = courierWeight * ratePerKg;
    } else if (settings.shippingMode === 'value') {
      let tempSubtotal = 0;
      for (const item of enrichedItems) {
        tempSubtotal += Number(item.qty || 0) * Number(item.unitPrice || 0);
      }
      if (tempSubtotal >= Number(settings.shippingValueThreshold || 999)) {
        courierCost = Number(settings.shippingValueAboveCharge || 0);
      } else {
        courierCost = Number(settings.shippingValueBelowCharge || 80);
      }
    }

    let shippingCharge = 0;
    if (req.body.shippingCharge !== undefined && req.body.shippingCharge !== null) {
      shippingCharge = Number(req.body.shippingCharge);
    } else {
      if (settings.shippingMode === 'included' || settings.shippingMode === 'free') {
        shippingCharge = 0;
      } else {
        if (settings.mergeShippingCharges) {
          shippingCharge = packingCost + handlingCost + courierCost + loadingCost;
        } else {
          shippingCharge = courierCost;
        }
      }
    }

    const charges = {
      shippingCharge,
      packingCharge: settings.mergeShippingCharges ? 0 : Number(req.body.packingCharge || 0),
      handlingCharge: settings.mergeShippingCharges ? 0 : Number(req.body.handlingCharge || 0),
      courierCharge: settings.mergeShippingCharges ? 0 : Number(req.body.courierCharge || 0),
      otherCharge: settings.mergeShippingCharges ? 0 : Number(req.body.otherCharge || 0),
    };

    let resolvedChannel = req.body.salesChannel || sale.salesChannel;
    const totals = calcInvoiceTotals(enrichedItems, discount, gstBillingMode, charges);

    const hasPendingItems = enrichedItems.some(item => item.pendingQty > 0);
    const resolvedStatus = hasPendingItems ? 'Waiting For Stock' : (req.body.status || 'Confirmed');

    let expectedDispatchDate = req.body.expectedDispatchDate;
    let commitment = req.body.commitment;
    if (resolvedStatus === 'Waiting For Stock') {
      const orderDate = date ? new Date(date) : new Date(sale.date);
      if (!expectedDispatchDate) {
        const d = new Date(orderDate);
        d.setDate(d.getDate() + 3);
        expectedDispatchDate = d;
      }
      if (!commitment) {
        commitment = 'Within 3 Days';
      }
    } else {
      expectedDispatchDate = req.body.expectedDispatchDate || null;
      commitment = req.body.commitment || null;
    }

    // Auto-calculate dueDate based on paymentTerms
    let dueDate = customDueDate ? new Date(customDueDate) : null;
    if (!dueDate) {
      let days = 0;
      const terms = customerRecord.paymentTerms || 'COD';
      if (terms.startsWith('Net ')) {
        const match = terms.match(/Net (\d+)/);
        if (match) {
          days = parseInt(match[1], 10);
        }
      }
      const invoiceDate = date ? new Date(date) : new Date(sale.date);
      dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + days);
    }

    // 6. Delete old invoice items
    await InvoiceItem.destroy({ where: { invoiceId: sale.id }, transaction: t });

    // 7. Create new invoice items and apply stock deduction
    for (const item of enrichedItems) {
      await InvoiceItem.create(
        {
          invoiceId: sale.id,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          freeQty: item.freeQty,
          schemeApplied: item.schemeApplied,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
          purchasePrice: item.purchasePrice,
          dispatchedQty: item.dispatchedQty,
          pendingQty: item.pendingQty,
          offerCost: item.offerCost,
          actualProfit: item.actualProfit,
        },
        { transaction: t }
      );

      if (item.productId && item.dispatchedQty > 0) {
        await updateStock(item.productId, -item.dispatchedQty, {
          type: 'sale',
          referenceId: sale.id,
          referenceModel: 'Invoice',
          userId: req.user.id,
          transaction: t,
        });
      }
    }

    // 8. Audit log text construction
    let auditDetails = `Invoice ${sale.invoiceNumber} edited by ${req.user.name || 'Admin'}.`;
    const changes = [];
    
    // Check item quantities change
    for (const newItem of enrichedItems) {
      const oldItem = sale.items.find(oi => 
        oi.productId === newItem.productId || 
        (oi.productId === null && newItem.productId === null && oi.name === newItem.name)
      );
      if (oldItem) {
        if (Number(oldItem.qty) !== Number(newItem.qty)) {
          changes.push(`Qty changed from ${oldItem.qty} → ${newItem.qty}`);
        }
      }
    }
    // Check total change
    if (Number(sale.grandTotal) !== Number(totals.grandTotal)) {
      changes.push(`Total changed from ₹${Number(sale.grandTotal).toFixed(0)} → ₹${Number(totals.grandTotal).toFixed(0)}`);
    }
    if (changes.length > 0) {
      auditDetails += ' ' + changes.join('. ') + '.';
    }

    // Calculate Indian GST parameters
    const companyGSTIN = (settings.gstNumber || '').trim().toUpperCase();
    const companyStateCode = (settings.stateCode || companyGSTIN.slice(0, 2)).trim().padStart(2, '0');
    const customerGSTIN = customerGst;
    const customerStateCode = customerGSTIN.slice(0, 2);
    const isIntraState = (invoiceType === 'GST' && companyStateCode && customerStateCode && companyStateCode === customerStateCode);

    let invoiceTaxableAmount = 0;
    let invoiceTotalGST = 0;
    let invoiceCgstAmount = 0;
    let invoiceSgstAmount = 0;
    let invoiceIgstAmount = 0;
    let hsnSummaryString = null;

    if (invoiceType === 'GST') {
      const summaryMap = {};
      for (const item of enrichedItems) {
        const prod = item.productId ? await Product.findByPk(item.productId, { transaction: t }) : null;
        const hsn = (prod && prod.gstClass) ? String(prod.gstClass).trim() : '0000';
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const gstPercent = Number(item.gstPercent || 0);
        
        let taxable = 0;
        let gst = 0;
        if (gstBillingMode === 'inclusive') {
          const lineTotal = qty * unitPrice;
          taxable = lineTotal / (1 + gstPercent / 100);
          gst = lineTotal - taxable;
        } else if (gstBillingMode === 'no_gst') {
          taxable = qty * unitPrice;
          gst = 0;
        } else { // exclusive
          taxable = qty * unitPrice;
          gst = (taxable * gstPercent) / 100;
        }
        
        if (!summaryMap[hsn]) {
          summaryMap[hsn] = {
            hsn,
            taxable: 0,
            gstRate: gstPercent,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalGst: 0
          };
        }
        
        summaryMap[hsn].taxable += taxable;
        summaryMap[hsn].totalGst += gst;
      }
      
      const hsnList = Object.values(summaryMap).map(hsnItem => {
        hsnItem.taxable = Number(hsnItem.taxable.toFixed(2));
        hsnItem.totalGst = Number(hsnItem.totalGst.toFixed(2));
        if (isIntraState) {
          hsnItem.cgst = Number((hsnItem.totalGst / 2).toFixed(2));
          hsnItem.sgst = Number((hsnItem.totalGst / 2).toFixed(2));
          hsnItem.igst = 0;
        } else {
          hsnItem.cgst = 0;
          hsnItem.sgst = 0;
          hsnItem.igst = hsnItem.totalGst;
        }
        return hsnItem;
      });
      
      hsnSummaryString = JSON.stringify(hsnList);
      invoiceTaxableAmount = Number(hsnList.reduce((sum, h) => sum + h.taxable, 0).toFixed(2));
      invoiceTotalGST = Number(hsnList.reduce((sum, h) => sum + h.totalGst, 0).toFixed(2));
      
      if (isIntraState) {
        invoiceCgstAmount = Number((invoiceTotalGST / 2).toFixed(2));
        invoiceSgstAmount = Number((invoiceTotalGST / 2).toFixed(2));
        invoiceIgstAmount = 0;
      } else {
        invoiceCgstAmount = 0;
        invoiceSgstAmount = 0;
        invoiceIgstAmount = invoiceTotalGST;
      }
    }

    // 9. Update the Invoice itself
    const oldCustomerId = sale.customerId;
    const newCustomerId = customerRecord.id;

    await sale.update(
      {
        customerId: newCustomerId,
        date: date ? new Date(date) : sale.date,
        dueDate,
        subtotal: totals.subtotal,
        discount: Number(discount),
        gstTotal: totals.gstTotal,
        grandTotal: totals.grandTotal,
        paymentMethod: paymentMethod || sale.paymentMethod,
        paymentStatus: paymentStatus || sale.paymentStatus,
        amountPaid: amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : totals.grandTotal,
        customerType,
        salesChannel: resolvedChannel,
        status: resolvedStatus,
        expectedDispatchDate,
        commitment,
        gstBillingMode,
        shippingCharge: totals.shippingCharge,
        packingCharge: totals.packingCharge,
        handlingCharge: totals.handlingCharge,
        courierCharge: totals.courierCharge,
        otherCharge: totals.otherCharge,
        packingCost,
        handlingCost,
        courierCost,
        loadingCost,
        roundOff: totals.roundOff,
        taxableValue: totals.subtotal,
        invoiceType,
        gstMode,
        sellerGSTIN: invoiceType === 'GST' ? (settings.gstNumber || null) : null,
        customerGSTIN: invoiceType === 'GST' ? (customerGst || null) : null,
        placeOfSupply: invoiceType === 'GST' ? (customerRecord.state || null) : null,
        gstApplicable: invoiceType === 'GST',
        isGSTReportable: invoiceType === 'GST',
        hsnSummary: hsnSummaryString,
        taxableAmount: invoiceTaxableAmount,
        cgstAmount: invoiceCgstAmount,
        sgstAmount: invoiceSgstAmount,
        igstAmount: invoiceIgstAmount,
        totalGST: invoiceTotalGST,
      },
      { transaction: t }
    );


    // 10. Update outstanding balance for customers
    await recomputeCustomerBalance(oldCustomerId, t);
    if (newCustomerId !== oldCustomerId) {
      await recomputeCustomerBalance(newCustomerId, t);
    }

    await t.commit();
    await logActivity(req.user.id, 'update', 'sales', auditDetails);

    const populated = await Invoice.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['name', 'phone', 'email', 'customerCode'] },
        { model: InvoiceItem, as: 'items', include: [{ model: Product, as: 'product' }] }
      ],
    });
    res.json({ success: true, sale: populated });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.updatePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNumber, allocations, paymentDate } = req.body;

    const Payment = require('../models/Payment');
    const payment = await Payment.findByPk(id, { transaction: t });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'Success') {
      return res.status(400).json({ message: 'Cannot edit a payment that is not in Success status' });
    }

    let totalAllocated = 0;
    if (allocations && allocations.length) {
      for (const alloc of allocations) {
        totalAllocated += Number(alloc.amount || 0);
      }
    } else {
      totalAllocated = Number(amount || payment.amount || 0);
    }

    payment.amount = totalAllocated;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber;
    if (allocations) payment.allocations = allocations;
    if (paymentDate) payment.date = new Date(paymentDate);

    await payment.save({ transaction: t });

    await t.commit();

    // Call reconcileInvoicesHelper to recalculate all invoices and customer balance
    await exports.reconcileInvoicesHelper(payment.customerId);

    // Fetch the updated customer record to get correct balance/outstanding count
    const customerRecord = await Customer.findByPk(payment.customerId);

    // Log activity
    await logActivity(
      req.user.id,
      'update',
      'payments',
      payment.id,
      `Updated payment ${payment.paymentNumber} of amount ₹${totalAllocated.toFixed(2)}`
    );

    res.json({
      message: 'Payment updated and reconciled successfully',
      outstandingBalance: customerRecord ? customerRecord.balance : 0,
      invoiceOutstandingCount: customerRecord ? customerRecord.invoiceOutstandingCount : 0
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const Payment = require('../models/Payment');
    const payment = await Payment.findByPk(id, { transaction: t });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'Success') {
      return res.status(400).json({ message: 'Payment is already cancelled' });
    }

    payment.status = 'Cancelled';
    await payment.save({ transaction: t });

    await t.commit();

    // Reconcile invoices and customer balance (it will exclude the cancelled payment)
    await exports.reconcileInvoicesHelper(payment.customerId);

    // Fetch the updated customer record
    const customerRecord = await Customer.findByPk(payment.customerId);

    // Log activity
    await logActivity(
      req.user.id,
      'delete',
      'payments',
      payment.id,
      `Cancelled payment ${payment.paymentNumber}`
    );

    res.json({
      message: 'Payment cancelled and reconciled successfully',
      outstandingBalance: customerRecord ? customerRecord.balance : 0,
      invoiceOutstandingCount: customerRecord ? customerRecord.invoiceOutstandingCount : 0
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};
