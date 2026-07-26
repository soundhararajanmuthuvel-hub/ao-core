const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { getSettings, getNextInvoiceNumber, getNextShipmentNumber, getNextOrderNumber, calcInvoiceTotals, logActivity } = require('../utils/helpers');
const { updateStock } = require('../utils/stockService');

// Create a new noted order (Prepared stage)
exports.createOrder = async (req, res, next) => {
  try {
    const {
      customerName,
      customerId,
      phoneNumber,
      area,
      address,
      notes,
      orderDate,
      expectedDispatchDate,
      logisticsCharge,
      items
    } = req.body;

    if (!customerName) {
      return res.status(400).json({ message: 'Customer Name is required' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'At least one product item is required' });
    }

    // Load settings and customer details for validations
    const settings = await getSettings();
    let customerRecord = null;
    if (customerId) {
      customerRecord = await Customer.findByPk(customerId);
    }
    const customerTier = customerRecord?.tier || 'RED';

    // Calculate delivery commitment and cutoff
    const cutoffHour = settings.sameDayCutoffHour !== undefined ? settings.sameDayCutoffHour : 13;
    const currentHour = new Date().getHours();
    const commitment = currentHour < cutoffHour ? 'Same Day' : 'Next Day';
    
    const resolvedOrderDate = orderDate ? new Date(orderDate) : new Date();
    let resolvedExpectedDispatchDate = expectedDispatchDate ? new Date(expectedDispatchDate) : null;
    if (!resolvedExpectedDispatchDate) {
      resolvedExpectedDispatchDate = new Date(resolvedOrderDate);
      if (commitment === 'Next Day') {
        resolvedExpectedDispatchDate.setDate(resolvedExpectedDispatchDate.getDate() + 1);
      }
    }

    const resolvedLogisticsCharge = logisticsCharge !== undefined && logisticsCharge !== null 
      ? Number(logisticsCharge) 
      : Number(settings.logisticsCharge || 16.00);

    // Compute initial totalAmount based on current product prices (using Tier Pricing)
    let totalAmount = resolvedLogisticsCharge;
    const orderItems = [];
    
    // N+1 Optimization: Fetch all products in one query
    const productIds = items.map(i => i.productId);
    const products = await Product.findAll({ where: { id: { [Op.in]: productIds } } });
    const productMap = new Map(products.map(p => [p.id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        return res.status(404).json({ message: `Product not found with ID: ${item.productId}` });
      }

      // Tier pricing extraction
      let resolvedPrice = product.sellingPrice;
      if (customerTier === 'GREEN' && Number(product.greenPrice) > 0) {
        resolvedPrice = product.greenPrice;
      } else if (customerTier === 'YELLOW' && Number(product.yellowPrice) > 0) {
        resolvedPrice = product.yellowPrice;
      } else if (customerTier === 'RED' && Number(product.redPrice) > 0) {
        resolvedPrice = product.redPrice;
      }

      const qty = Number(item.qty || 1);
      let unitPrice = Number(resolvedPrice);

      // Verify salesman role price edits blockage
      if (req.user.role === 'Salesman' || req.user.role === 'Sales Executive') {
        unitPrice = Number(resolvedPrice); // Salesman cannot edit prices
      } else if (item.unitPrice !== undefined) {
        unitPrice = Number(item.unitPrice);
      }

      const gstPercent = Number(product.gstPercent || 0);
      const lineTotal = qty * unitPrice;
      
      totalAmount += lineTotal;
      orderItems.push({
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        gstPercent,
        lineTotal
      });
    }

    // Minimum Order Validation
    const minGreen = Number(settings.minOrderGreen !== undefined ? settings.minOrderGreen : 10000.00);
    const minYellow = Number(settings.minOrderYellow !== undefined ? settings.minOrderYellow : 5000.00);
    const minRed = Number(settings.minOrderRed !== undefined ? settings.minOrderRed : 2000.00);
    let requiredMin = minRed;
    if (customerTier === 'GREEN') requiredMin = minGreen;
    else if (customerTier === 'YELLOW') requiredMin = minYellow;

    if (totalAmount < requiredMin) {
      if (req.user.role !== 'Super Admin' && req.user.role !== 'admin' && req.user.role !== 'admin') {
        return res.status(400).json({
          message: `Order amount (₹${totalAmount.toFixed(2)}) is below the minimum required amount (₹${requiredMin.toFixed(2)}) for ${customerTier} Tier customers. Submission blocked.`
        });
      }
    }

    const orderNumber = await getNextOrderNumber();
    const order = await Order.create({
      orderNumber,
      customerName,
      customerId: customerId || null,
      phoneNumber,
      area,
      address,
      notes,
      orderDate: resolvedOrderDate,
      expectedDispatchDate: resolvedExpectedDispatchDate,
      status: 'Prepared',
      logisticsCharge: resolvedLogisticsCharge,
      totalAmount: Number(totalAmount.toFixed(2)),
      items: orderItems,
      source: req.body.source || 'ERP_Manual',
      aiMetadata: req.body.aiMetadata || { commitment }
    });

    await logActivity(req.user.id, 'create', 'orders', `Noted order ${orderNumber} for ${customerName}`);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
};

// Retrieve all orders
exports.listOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = {};
    if (status) {
      query.status = status;
    }
    if (req.query.customerId) {
      query.customerId = req.query.customerId;
    }
    if (search) {
      query[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { phoneNumber: { [Op.like]: `%${search}%` } },
        { area: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count: total, rows: orders } = await Order.findAndCountAll({
      where: query,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'customerType', 'paymentTerms', 'balance', 'paymentCycle', 'invoiceOutstandingCount', 'lastPaymentDate', 'averagePaymentDays', 'customerCode'] },
        { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber', 'grandTotal', 'status'] },
        { model: Shipment, as: 'shipment', attributes: ['id', 'shipmentNumber', 'status', 'trackingNumber', 'courier'] }
      ],
      order: [['orderDate', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit
    });

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// Retrieve a single order details
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Invoice, as: 'invoice' },
        { model: Shipment, as: 'shipment' }
      ]
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
};

// Mark as Packed (Step 2: verifying stock, deducting stock, creating invoice & shipment)
exports.markPacked = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Prepared') {
      await t.rollback();
      return res.status(400).json({ message: `Order status is currently '${order.status}'. Only Prepared orders can be packed.` });
    }

    // Resolve or create Customer record
    let customerRecord = null;
    if (order.customerId) {
      customerRecord = await Customer.findByPk(order.customerId, { transaction: t });
    }
    if (!customerRecord) {
      // Find by exact name & phone
      customerRecord = await Customer.findOne({
        where: {
          name: order.customerName,
          phone: order.phoneNumber || ''
        },
        transaction: t
      });
    }
    if (!customerRecord) {
      // Auto-create customer in customer master
      customerRecord = await Customer.create({
        name: order.customerName,
        phone: order.phoneNumber || '',
        address: order.address || '',
        state: order.area || '',
        customerType: 'Retail Shop',
        paymentTerms: 'COD',
        status: 'Active'
      }, { transaction: t });
      
      order.customerId = customerRecord.id;
    }

    const settings = await getSettings({ transaction: t });
    const specialPricing = customerRecord.specialPricing || {};
    const customerType = customerRecord.customerType || 'Retail Shop';

    // Resolve GST billing mode
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

    // Verify stock availability & Enrich items
    const enrichedItems = [];
    let totalProdWeight = 0;
    
    for (const item of order.items) {
      const product = await Product.findByPk(item.productId, { transaction: t });
      if (!product) {
        throw new Error(`Product not found with ID: ${item.productId}`);
      }

      // Customer Special Pricing / Discount / Scheme Override
      const productOverride = specialPricing[product.id] || specialPricing[product.sku] || null;
      let basePrice = Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice);
      let itemDiscountPercent = 0;
      let schemeApplied = 'None';

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

      // Calculate free quantity based on scheme (e.g. 10+1, 20+2)
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(item.qty / buyQty) * getQty;
      }

      const totalRequestedQty = item.qty + freeQty;
      const stockAvailable = Number(product.stock || 0);

      if (stockAvailable < totalRequestedQty) {
        throw new Error(`Insufficient stock for product '${product.name}' (Available: ${stockAvailable}, Required: ${totalRequestedQty})`);
      }

      totalProdWeight += totalRequestedQty * Number(product.weight || 0.200);
      const netUnitPrice = basePrice * (1 - itemDiscountPercent / 100);

      let lineTotal = 0;
      const itemGstPercent = Number(product.gstPercent || 0);

      if (gstBillingMode === 'inclusive') {
        lineTotal = item.qty * netUnitPrice;
      } else if (gstBillingMode === 'no_gst') {
        lineTotal = item.qty * netUnitPrice;
      } else { // exclusive
        lineTotal = item.qty * netUnitPrice * (1 + itemGstPercent / 100);
      }

      const offerCost = freeQty * Number(product.purchasePrice || 0);
      const actualProfit = (item.qty * netUnitPrice) - (totalRequestedQty * Number(product.purchasePrice || 0));

      enrichedItems.push({
        productId: product.id,
        name: product.name,
        qty: item.qty,
        freeQty,
        schemeApplied,
        unitPrice: netUnitPrice,
        gstPercent: itemGstPercent,
        lineTotal,
        purchasePrice: Number(product.purchasePrice),
        dispatchedQty: totalRequestedQty,
        pendingQty: 0,
        offerCost,
        actualProfit
      });
    }

    // Auto-calculate parcel weight
    let parcelWeight = 1.5;
    if (totalProdWeight <= 1.0) {
      parcelWeight = 1.5;
    } else if (totalProdWeight <= 5.0) {
      parcelWeight = 5.0;
    } else if (totalProdWeight <= 10.0) {
      parcelWeight = 10.0;
    } else {
      const boxW = Number(settings.boxWeight || 0.200);
      const packW = Number(settings.packingMaterialWeight || 0.100);
      parcelWeight = Number((totalProdWeight + boxW + packW).toFixed(3));
    }

    // Deduct stock
    for (const item of enrichedItems) {
      await updateStock(item.productId, -item.dispatchedQty, {
        type: 'sale',
        referenceModel: 'Invoice',
        userId: req.user.id,
        transaction: t
      });
    }

    // Generate Invoice
    const charges = {
      shippingCharge: Number(order.logisticsCharge || 16.00),
      packingCharge: 0,
      handlingCharge: 0,
      courierCharge: 0,
      otherCharge: 0
    };
    const totals = calcInvoiceTotals(enrichedItems, 0, gstBillingMode, charges);
    const invoiceNumber = await getNextInvoiceNumber({ transaction: t });

    // Resolve credit days
    let days = 0;
    const terms = customerRecord.paymentTerms || 'COD';
    if (terms.startsWith('Net ')) {
      const match = terms.match(/Net (\d+)/);
      if (match) days = parseInt(match[1], 10);
    }
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);

    let resolvedChannel = 'Retail Shop';
    if (customerType === 'White Label') resolvedChannel = 'White Label';
    else if (customerType === 'Organic Store') resolvedChannel = 'Organic Store';
    else if (customerType === 'Retail Shop') resolvedChannel = 'Retail Shop';
    else if (customerType === 'D2C Customer') resolvedChannel = 'D2C';
    else if (customerType === 'Distributor') resolvedChannel = 'Distributor';
    else if (customerType === 'Wholesaler') resolvedChannel = 'Wholesale';

    const invoice = await Invoice.create({
      invoiceNumber,
      customerId: customerRecord.id,
      date: invoiceDate,
      dueDate,
      subtotal: totals.subtotal,
      discount: 0,
      gstTotal: totals.gstTotal,
      grandTotal: totals.grandTotal,
      paymentMethod: terms === 'COD' ? 'cash' : 'credit',
      paymentStatus: 'pending',
      amountPaid: 0,
      customerType,
      salesChannel: resolvedChannel,
      createdById: req.user.id,
      status: 'Confirmed',
      gstBillingMode,
      shippingCharge: totals.shippingCharge,
      packingCharge: 0,
      handlingCharge: 0,
      courierCharge: 0,
      otherCharge: 0,
      packingCost: Number(settings.packingCost || 0),
      handlingCost: Number(settings.handlingCost || 0),
      courierCost: Number(settings.courierCost || 0),
      loadingCost: Number(settings.loadingCost || 0),
      roundOff: totals.roundOff,
      taxableValue: totals.subtotal
    }, { transaction: t });

    // Link stock movements referenceId to Invoice
    // In updateStock, referenceId is generated by sequelize. Since we called updateStock earlier, we'll quickly query those stock movements and update their referenceId
    const StockMovement = require('../models/StockMovement');
    await StockMovement.update(
      { referenceId: invoice.id },
      {
        where: {
          productId: enrichedItems.map(i => i.productId),
          type: 'sale',
          referenceId: null,
          createdAt: { [Op.gte]: new Date(Date.now() - 5000) } // past 5s
        },
        transaction: t
      }
    );

    // Create Invoice Items
    for (const item of enrichedItems) {
      await InvoiceItem.create({
        invoiceId: invoice.id,
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
        pendingQty: 0,
        offerCost: item.offerCost,
        actualProfit: item.actualProfit
      }, { transaction: t });
    }

    // Generate Shipment (Awaiting Dispatch)
    const shipmentNumber = await getNextShipmentNumber({ commit: t });
    const shipment = await Shipment.create({
      shipmentNumber,
      invoiceId: invoice.id,
      trackingNumber: '', // Keep NULL/empty for Packing Slip Copy
      courier: '', // Blank
      shipmentDate: new Date(),
      status: 'Pending', // Awaiting Dispatch
      courierStatus: 'Pending',
      packageWeight: parcelWeight,
      packageCount: 1,
      createdById: req.user.id,
      trackingTimeline: [
        {
          status: 'Pending',
          timestamp: new Date(),
          details: 'Awaiting Dispatch. Parcel packed and ready in warehouse.'
        }
      ]
    }, { transaction: t });

    // Update order with associations & Packed status
    order.status = 'Packed';
    order.invoiceId = invoice.id;
    order.shipmentId = shipment.id;
    
    // update items list in order with resolved unitPrices/lineTotals
    order.items = enrichedItems.map(i => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
      gstPercent: i.gstPercent,
      lineTotal: i.lineTotal
    }));
    order.totalAmount = totals.grandTotal;

    await order.save({ transaction: t });

    // Save outstanding balance on customer record
    customerRecord.balance = Number(customerRecord.balance) + totals.grandTotal;
    await customerRecord.save({ transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'update', 'orders', `Packed order ${order.orderNumber}. Generated invoice ${invoiceNumber} and shipment ${shipmentNumber}.`);
    
    res.json({ order, invoice, shipment });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message || 'Mark as packed failed' });
  }
};

// Mark as Dispatched
exports.markDispatched = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Packed') {
      await t.rollback();
      return res.status(400).json({ message: `Order status is '${order.status}'. Order must be Packed to dispatch.` });
    }

    const { courierPartner, trackingNumber, dispatchDate } = req.body;
    if (!courierPartner || !trackingNumber) {
      await t.rollback();
      return res.status(400).json({ message: 'Courier Partner and Tracking Number are required for dispatch.' });
    }

    const resolvedDispatchDate = dispatchDate ? new Date(dispatchDate) : new Date();

    // Update Order
    order.status = 'Dispatched';
    order.courierPartner = courierPartner;
    order.trackingNumber = trackingNumber;
    order.dispatchDate = resolvedDispatchDate;
    await order.save({ transaction: t });

    // Update Shipment
    if (order.shipmentId) {
      const shipment = await Shipment.findByPk(order.shipmentId, { transaction: t });
      if (shipment) {
        shipment.courier = courierPartner;
        shipment.trackingNumber = trackingNumber;
        shipment.status = 'In Transit';
        shipment.courierStatus = 'In Transit';
        
        const trackingTimeline = Array.isArray(shipment.trackingTimeline) ? shipment.trackingTimeline : [];
        trackingTimeline.push({
          status: 'In Transit',
          timestamp: resolvedDispatchDate,
          details: `Dispatched from warehouse via ${courierPartner}. Tracking AWB: ${trackingNumber}.`
        });
        shipment.trackingTimeline = trackingTimeline;

        const courierTimeline = Array.isArray(shipment.courierTimeline) ? shipment.courierTimeline : [];
        courierTimeline.push({
          status: 'Booked',
          timestamp: resolvedDispatchDate,
          location: 'AO Warehouse',
          details: 'Consignment scanned and ready for transit.',
          courier: courierPartner
        });
        shipment.courierTimeline = courierTimeline;

        await shipment.save({ transaction: t });
      }
    }

    // Simulate sending Invoice PDF, Delivery Slip PDF, Tracking Number, Tracking Link via WhatsApp
    const trackingLink = `${req.headers.origin || 'http://localhost:5173'}/track/${trackingNumber}`;
    console.log(`[Notification Sim] WhatsApp sent to customer ${order.phoneNumber || 'customer'}: "Dear ${order.customerName}, your order ${order.orderNumber} has been dispatched via ${courierPartner} (AWB: ${trackingNumber}). Track your package live here: ${trackingLink}. Attached: Invoice & Delivery Slip PDFs."`);

    await t.commit();
    await logActivity(req.user.id, 'update', 'orders', `Dispatched order ${order.orderNumber} via ${courierPartner}`);
    
    res.json({ order, trackingLink });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Mark as Delivered
exports.markDelivered = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Dispatched') {
      await t.rollback();
      return res.status(400).json({ message: `Order status is '${order.status}'. Order must be Dispatched to mark as delivered.` });
    }

    const { deliveryDate, deliveredBy, remarks } = req.body;
    const resolvedDeliveryDate = deliveryDate ? new Date(deliveryDate) : new Date();

    // Update Order
    order.status = 'Delivered';
    order.deliveryDate = resolvedDeliveryDate;
    order.deliveredBy = deliveredBy || 'Logistics Partner';
    order.remarks = remarks || '';
    await order.save({ transaction: t });

    // Update Shipment
    if (order.shipmentId) {
      const shipment = await Shipment.findByPk(order.shipmentId, { transaction: t });
      if (shipment) {
        shipment.status = 'Delivered';
        shipment.courierStatus = 'Delivered';
        shipment.courierDeliveredDate = resolvedDeliveryDate;
        
        const trackingTimeline = Array.isArray(shipment.trackingTimeline) ? shipment.trackingTimeline : [];
        trackingTimeline.push({
          status: 'Delivered',
          timestamp: resolvedDeliveryDate,
          details: `Parcel delivered successfully. Signed by recipient. Remarks: ${remarks || 'None'}`
        });
        shipment.trackingTimeline = trackingTimeline;

        const courierTimeline = Array.isArray(shipment.courierTimeline) ? shipment.courierTimeline : [];
        courierTimeline.push({
          status: 'Delivered',
          timestamp: resolvedDeliveryDate,
          location: 'Destination',
          details: `Successfully delivered by ${deliveredBy || 'Courier Agent'}.`,
          courier: shipment.courier
        });
        shipment.courierTimeline = courierTimeline;

        await shipment.save({ transaction: t });
      }
    }

    // Update related Invoice payment status to paid if payment terms are COD or if payment method was cash on delivery
    if (order.invoiceId) {
      const invoice = await Invoice.findByPk(order.invoiceId, { transaction: t });
      if (invoice && invoice.paymentMethod === 'cash') {
        invoice.paymentStatus = 'paid';
        invoice.amountPaid = invoice.grandTotal;
        await invoice.save({ transaction: t });
        
        // deduct from customer outstanding balance
        const customerRecord = await Customer.findByPk(order.customerId, { transaction: t });
        if (customerRecord) {
          customerRecord.balance = Math.max(0, Number(customerRecord.balance) - invoice.grandTotal);
          await customerRecord.save({ transaction: t });
        }
      }
    }

    // Simulate WhatsApp delivery confirmation
    console.log(`[Notification Sim] WhatsApp sent to customer ${order.phoneNumber || 'customer'}: "Dear ${order.customerName}, your package for order ${order.orderNumber} has been delivered successfully. Thank you for choosing Amudhasurabiy Organics!"`);

    await t.commit();
    await logActivity(req.user.id, 'update', 'orders', `Marked order ${order.orderNumber} as Delivered.`);
    
    res.json({ order });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Fetch Order Dashboard stats and Delay Alerts
exports.getOrderDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const delayThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Queries
    const [todayCount, preparedCount, packedCount, dispatchedCount, deliveredCount, delayedCount] = await Promise.all([
      Order.count({ where: { orderDate: { [Op.gte]: today, [Op.lt]: tomorrow } } }),
      Order.count({ where: { status: 'Prepared' } }),
      Order.count({ where: { status: 'Packed' } }),
      Order.count({ where: { status: 'Dispatched' } }),
      Order.count({ where: { status: 'Delivered' } }),
      Order.count({
        where: {
          status: 'Prepared',
          orderDate: { [Op.lte]: delayThreshold }
        }
      })
    ]);

    res.json({
      todayOrders: todayCount,
      preparedOrders: preparedCount,
      packedOrders: packedCount,
      dispatchedOrders: dispatchedCount,
      deliveredOrders: deliveredCount,
      delayedOrders: delayedCount
    });
  } catch (err) {
    next(err);
  }
};
