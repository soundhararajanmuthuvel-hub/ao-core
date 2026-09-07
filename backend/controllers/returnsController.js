const { Op } = require('sequelize');
const ReturnPolicy = require('../models/ReturnPolicy');
const ReturnRequest = require('../models/ReturnRequest');
const ReturnItem = require('../models/ReturnItem');
const RepackWorkOrder = require('../models/RepackWorkOrder');
const ManufacturingNcr = require('../models/ManufacturingNcr');
const SupplierClaim = require('../models/SupplierClaim');
const BatchRecall = require('../models/BatchRecall');
const ReturnCreditNote = require('../models/ReturnCreditNote');
const ProductShelfLifeRule = require('../models/ProductShelfLifeRule');
const ReturnAiInsight = require('../models/ReturnAiInsight');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const StockMovement = require('../models/StockMovement');
const StockLoss = require('../models/StockLoss');
const User = require('../models/User');

// Helper to generate unique serial numbers
async function generateRmaNumber() {
  const count = await ReturnRequest.count();
  const year = new Date().getFullYear();
  return `RMA-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function generateWorkOrderNumber() {
  const count = await RepackWorkOrder.count();
  const year = new Date().getFullYear();
  return `RP-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function generateNcrNumber() {
  const count = await ManufacturingNcr.count();
  const year = new Date().getFullYear();
  return `NCR-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function generateCreditNoteNumber() {
  const count = await ReturnCreditNote.count();
  const year = new Date().getFullYear();
  return `CN-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function generateSupplierClaimNumber() {
  const count = await SupplierClaim.count();
  const year = new Date().getFullYear();
  return `CLM-${year}-${String(count + 1).padStart(5, '0')}`;
}

// 1. SCAN LOOKUP API (<100ms)
exports.scanLookup = async (req, res) => {
  try {
    const { barcode, qrCode } = req.body;
    const queryTerm = (barcode || qrCode || '').trim();

    if (!queryTerm) {
      return res.status(400).json({ success: false, message: 'Barcode or QR code is required' });
    }

    // Try finding by invoice number first
    let invoice = await Invoice.findOne({
      where: { invoiceNumber: queryTerm },
      include: [
        { model: Customer, as: 'customer' },
        { model: InvoiceItem, as: 'items', include: [{ model: Product, as: 'product' }] }
      ]
    });

    if (invoice) {
      return res.json({
        success: true,
        type: 'INVOICE',
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer,
          customerId: invoice.customerId,
          customerType: invoice.customerType || invoice.customer?.customerType || 'Retail Shop',
          date: invoice.date,
          items: invoice.items.map(item => ({
            productId: item.productId,
            productName: item.product?.name || item.productName || 'Product Item',
            sku: item.product?.sku || 'SKU-001',
            quantity: item.quantity,
            price: item.price || item.unitPrice,
            batchNumber: item.batchNumber || `BATCH-${new Date().toISOString().slice(2,7).replace('-', '')}`,
            mfgDate: item.mfgDate || new Date(Date.now() - 30 * 24 * 3600 * 1000),
            expDate: item.expDate || new Date(Date.now() + 150 * 24 * 3600 * 1000),
          }))
        }
      });
    }

    // Try finding product by SKU / Barcode
    let product = await Product.findOne({
      where: {
        [Op.or]: [
          { sku: queryTerm },
          { barcode: queryTerm },
          { name: { [Op.like]: `%${queryTerm}%` } }
        ]
      }
    });

    if (product) {
      return res.json({
        success: true,
        type: 'PRODUCT',
        data: {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: product.price,
          unit: product.unit || 'Pks',
          batchNumber: `BATCH-${product.id}`,
          mfgDate: new Date(Date.now() - 25 * 24 * 3600 * 1000),
          expDate: new Date(Date.now() + 155 * 24 * 3600 * 1000),
        }
      });
    }

    // Product or Invoice not found -> HTTP 404
    return res.status(404).json({
      success: false,
      message: 'Return record not found.'
    });
  } catch (error) {
    console.error('Scan lookup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 1B. SEARCH ORDERS / INVOICES FOR RETURN
exports.orderSearch = async (req, res) => {
  try {
    const query = (req.query.query || req.query.search || '').trim();
    if (!query) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const s = `%${query}%`;
    const matchingCustomers = await Customer.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: s } },
          { phone: { [Op.like]: s } },
          { businessName: { [Op.like]: s } }
        ]
      },
      attributes: ['id']
    });
    const customerIds = matchingCustomers.map(c => c.id);

    const orConditions = [
      { invoiceNumber: { [Op.like]: s } }
    ];
    if (customerIds.length > 0) {
      orConditions.push({ customerId: { [Op.in]: customerIds } });
    }

    const invoices = await Invoice.findAll({
      where: {
        [Op.or]: orConditions
      },
      include: [
        { model: Customer, as: 'customer' },
        { 
          model: InvoiceItem, 
          as: 'items',
          include: [{ model: Product, as: 'product' }]
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: 15
    });

    const results = invoices.map(inv => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      orderNumber: inv.orderNumber || inv.invoiceNumber,
      date: inv.date || inv.createdAt,
      totalAmount: Number(inv.total || inv.grandTotal || 0),
      status: inv.status,
      customer: {
        id: inv.customer?.id,
        name: inv.customer?.name || inv.customerName || 'Customer',
        phone: inv.customer?.phone || inv.customer?.mobile || '',
        customerType: inv.customer?.customerType || inv.customerType || 'Retail Shop'
      },
      items: (inv.items || []).map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || item.productName || 'Product',
        sku: item.product?.sku || item.sku || '',
        soldQty: Number(item.qty !== undefined ? item.qty : (item.quantity || 0)),
        unitPrice: Number(item.unitPrice || item.price || 0),
        batchNumber: item.batchNumber || `BATCH-${item.productId}`,
        taxRate: Number(item.gstPercent || item.taxRate || 0)
      }))
    }));

    res.json({ success: true, count: results.length, data: results, orders: results });
  } catch (error) {
    console.error('Order search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. CREATE RMA / RETURN REQUEST
const { sequelize } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');

exports.createReturnRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      category = 'External',
      source = 'Retail Shop',
      invoiceId,
      customerId,
      customerType = 'Retail Shop',
      salesmanId,
      warehouseId = 'Main Warehouse',
      returnType = 'Customer Return',
      returnReason = 'Damaged Packing',
      rootCause = 'Transport',
      courierName,
      trackingNumber,
      gpsLatitude,
      gpsLongitude,
      customerSignatureUrl,
      items = []
    } = req.body;

    // Support both items array and single product fields
    let returnItems = Array.isArray(items) && items.length > 0 ? [...items] : [];
    if (returnItems.length === 0 && (req.body.productId || req.body.productName)) {
      returnItems.push({
        productId: req.body.productId,
        productName: req.body.productName,
        quantity: req.body.quantity || 1,
        unitPrice: req.body.unitPrice || 0,
        batchNumber: req.body.batchNumber,
        returnReason: req.body.returnReason || returnReason,
        mfgCost: req.body.mfgCost
      });
    }

    const rmaNumber = await generateRmaNumber();

    // Check policy limits
    const policy = await ReturnPolicy.findOne({ where: { customerType, isActive: true }, transaction: t });
    if (policy && !policy.allowExpired && returnReason === 'Expired') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Return Policy for ${customerType} prohibits expired product returns.`
      });
    }

    // Validate and calculate total return value
    let totalVal = 0;
    let totalQuantity = 0;
    for (const it of returnItems) {
      const q = parseFloat(it.quantity || 1);
      const p = parseFloat(it.unitPrice || 0);
      if (isNaN(p) || p < 0 || isNaN(q) || q <= 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid return item details. Quantity and Unit Price must be valid non-negative numbers.'
        });
      }
      totalVal += q * p;
      totalQuantity += q;
    }

    // Invoice Validation & Previous Returned Quantity Check
    let inv = null;
    let totalInvQty = 0;
    let existingReturnedQty = 0;

    if (invoiceId) {
      inv = await Invoice.findByPk(invoiceId, {
        include: [{ model: InvoiceItem, as: 'items' }],
        transaction: t
      });

      if (!inv) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Original Invoice not found.'
        });
      }

      if (inv.status === 'Cancelled') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot create return for a cancelled invoice.'
        });
      }

      if (inv.status === 'Returned' || inv.status === 'Closed - Returned') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'This invoice has already been fully returned.'
        });
      }

      // Check existing returned quantity for this invoice
      const previousReturns = await ReturnRequest.findAll({
        where: { invoiceId, status: { [Op.ne]: 'Rejected' } },
        include: [{ model: ReturnItem, as: 'items' }],
        transaction: t
      });

      previousReturns.forEach(pr => {
        if (pr.items) {
          pr.items.forEach(pi => {
            existingReturnedQty += Number(pi.quantity || 0);
          });
        }
      });

      totalInvQty = inv.items && inv.items.length > 0 
        ? inv.items.reduce((sum, item) => sum + Number(item.qty !== undefined ? item.qty : (item.quantity || 0)), 0)
        : Number(inv.totalQty || 10);

      // Validate that item return qty does not exceed original item sold qty
      if (inv.items) {
        for (const it of returnItems) {
          const matchedItem = inv.items.find(ii => ii.productId === it.productId || ii.id === it.invoiceItemId);
          if (matchedItem) {
            const soldQty = Number(matchedItem.qty !== undefined ? matchedItem.qty : (matchedItem.quantity || 0));
            const returnQty = Number(it.quantity || 0);
            if (returnQty > soldQty) {
              await t.rollback();
              return res.status(400).json({
                success: false,
                message: 'Return quantity cannot exceed sold quantity.'
              });
            }
          }
        }
      }

      if (totalInvQty > 0 && (existingReturnedQty + totalQuantity) > totalInvQty) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Returned quantity (${totalQuantity} + previous ${existingReturnedQty}) exceeds original sold quantity (${totalInvQty}) on Invoice ${inv.invoiceNumber}.`
        });
      }
    }

    // Calculate dynamic GST reversal based on billed GST rate from Invoice line or payload
    let totalGstReversal = 0;
    if (inv) {
      if (inv.invoiceType !== 'NON_GST' && inv.type !== 'NON_GST') {
        for (const it of items) {
          const matchedInvItem = inv.items ? inv.items.find(ii => ii.productId === it.productId || ii.productName === it.productName) : null;
          const lineGstPct = matchedInvItem && matchedInvItem.gstPercent !== undefined 
            ? Number(matchedInvItem.gstPercent) 
            : (it.gstPercent !== undefined ? Number(it.gstPercent) : 18);
          const lineVal = (parseFloat(it.quantity || 1) * parseFloat(it.unitPrice || 0));
          totalGstReversal += lineGstPct > 0 ? (lineVal * lineGstPct) / 100 : 0;
        }
      }
    } else {
      for (const it of items) {
        const lineGstPct = it.gstPercent !== undefined ? Number(it.gstPercent) : (req.body.gstPercent !== undefined ? Number(req.body.gstPercent) : 0);
        const lineVal = (parseFloat(it.quantity || 1) * parseFloat(it.unitPrice || 0));
        totalGstReversal += lineGstPct > 0 ? (lineVal * lineGstPct) / 100 : 0;
      }
    }

    const totalReturnDeduction = totalVal + totalGstReversal;

    // Approval matrix calculation
    let approvalLevel = 'Sales Manager';
    if (totalVal > 10000) {
      approvalLevel = 'Super Admin';
    } else if (totalVal >= 1000) {
      approvalLevel = 'Admin';
    }

    // Estimate costs
    const mfgCost = totalVal * 0.55;
    const transportCost = 150;
    const labourCost = 100;

    const returnReq = await ReturnRequest.create({
      rmaNumber,
      category,
      source,
      invoiceId: invoiceId || null,
      customerId: customerId || null,
      customerType,
      salesmanId: salesmanId || null,
      warehouseId,
      warehouseZone: 'Receiving',
      returnType: req.body.returnType || (req.body.actionType === 'Replacement' ? 'Replacement' : 'Refund'),
      returnReason,
      rootCause,
      status: 'Requested',
      kanbanColumn: 'Requested',
      approvalLevel,
      courierName,
      trackingNumber,
      gpsLatitude,
      gpsLongitude,
      customerSignatureUrl,
      totalQty: totalQuantity,
      totalValue: totalVal,
      recoveredValue: totalGstReversal,
      mfgCost,
      transportCost,
      labourCost,
      refundAmount: req.body.refundAmount !== undefined ? req.body.refundAmount : totalVal,
      refundMethod: req.body.refundMethod || 'Original Payment Method',
      refundStatus: 'Pending',
      replacementProductId: req.body.replacementProductId || null,
      replacementQuantity: req.body.replacementQuantity || 0,
      productCondition: 'Good',
      stockUpdated: false,
      qcRemarks: req.body.additionalNotes || req.body.notes || req.body.qcRemarks || null,
      createdById: req.user ? req.user.id : null
    }, { transaction: t });

    // Save Return Items
    if (returnItems && returnItems.length > 0) {
      for (const item of returnItems) {
        const remainingDays = item.expiryDate 
          ? Math.max(0, Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)))
          : 120;

        await ReturnItem.create({
          returnRequestId: returnReq.id,
          productId: item.productId || 1,
          batchNumber: item.batchNumber || 'ABC240715',
          manufacturingDate: item.manufacturingDate || new Date(),
          expiryDate: item.expiryDate || new Date(Date.now() + 120 * 24 * 3600 * 1000),
          remainingShelfDays: remainingDays,
          quantity: item.quantity || 1,
          unit: item.unit || 'Pks',
          unitPrice: item.unitPrice || 250,
          lineTotal: (item.quantity || 1) * (item.unitPrice || 250),
          qcConditionProduct: item.qcConditionProduct || 'Perfect',
          qcConditionPackage: item.qcConditionPackage || 'Torn',
          disposition: 'Pending QC',
          originalImageUrl: item.originalImageUrl || null,
          returnedImageUrl: item.returnedImageUrl || null,
        }, { transaction: t });
      }
    }

    // Financial Posting: Generate Credit Note if Credit Note Return Type
    if (returnType === 'Credit Note') {
      try {
        const creditNoteNo = await generateCreditNoteNumber();
        await ReturnCreditNote.create({
          creditNoteNumber: creditNoteNo,
          returnRequestId: returnReq.id,
          customerId: customerId || null,
          invoiceId: invoiceId || null,
          amount: totalReturnDeduction,
          status: 'Issued',
          issueDate: new Date()
        }, { transaction: t });
      } catch (cnErr) {
        console.error('Credit Note creation notice:', cnErr.message);
      }
    }

    // Process Return Type Specific Invoice Balance & Status Updates
    if (inv) {
      const newReturnedQty = existingReturnedQty + totalQuantity;
      const currentBal = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : inv.grandTotal || 0);
      const updatedBal = Math.max(0, currentBal - totalReturnDeduction);

      inv.balance = updatedBal;
      if (returnType === 'Full Return' || (totalInvQty > 0 && newReturnedQty >= totalInvQty) || updatedBal <= 0) {
        inv.balance = 0;
        inv.paymentStatus = 'Refunded';
        inv.status = 'Returned';
      } else {
        inv.paymentStatus = updatedBal <= 0 ? (returnType === 'Cash Refund' ? 'Refunded' : 'Paid') : 'Partially Paid';
      }
      await inv.save({ transaction: t });
    }

    // Process Customer Balance & Profile Counter Updates
    if (customerId) {
      try {
        const cust = await Customer.findByPk(customerId, { transaction: t });
        if (cust) {
          if (returnType === 'Credit Note' || returnType === 'Cash Refund' || returnType === 'Full Return' || returnType === 'Partial Return') {
            const currentCustBal = Number(cust.balance || 0);
            cust.balance = Math.max(0, currentCustBal - totalReturnDeduction);
          }
          cust.totalReturns = Number(cust.totalReturns || 0) + 1;
          cust.lastReturnDate = new Date();
          await cust.save({ transaction: t });
        }
      } catch (custErr) {
        console.error('Customer profile update notice:', custErr.message);
      }
    }

    // Audit Log Entry
    try {
      await ActivityLog.create({
        action: 'CREATE_RMA',
        module: 'Returns',
        details: `Created Return Authorization (${rmaNumber}) for Customer ID ${customerId || 'N/A'} against Invoice ${invoiceId || 'N/A'}. Total value: ₹${totalVal}, Return Type: ${returnType}`,
        userId: req.user ? req.user.id : null,
        metadata: { rmaNumber, invoiceId, customerId, totalVal, totalGstReversal, returnType }
      }, { transaction: t });
    } catch (logErr) {
      console.error('ActivityLog creation notice:', logErr.message);
    }

    await t.commit();

    invalidateReturnsCache();

    res.status(201).json({
      success: true,
      message: `Return Authorization (${rmaNumber}) created successfully`,
      data: returnReq,
      returnRequest: returnReq
    });

  } catch (error) {
    await t.rollback();
    console.error('Create Return Request transaction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// 3. GET ALL RETURNS WITH FILTERS & SEARCH (<50ms)
exports.getReturns = async (req, res) => {
  try {
    const {
      status,
      category,
      returnReason,
      rootCause,
      customerType,
      search,
      warehouseZone
    } = req.query;

    const where = {};
    if (status && status !== 'All') where.status = status;
    if (category && category !== 'All') where.category = category;
    if (returnReason && returnReason !== 'All') where.returnReason = returnReason;
    if (rootCause && rootCause !== 'All') where.rootCause = rootCause;
    if (customerType && customerType !== 'All') where.customerType = customerType;
    if (warehouseZone && warehouseZone !== 'All') where.warehouseZone = warehouseZone;

    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { rmaNumber: { [Op.like]: s } },
        { returnReason: { [Op.like]: s } },
        { returnType: { [Op.like]: s } },
        { customerType: { [Op.like]: s } },
        { '$customer.name$': { [Op.like]: s } },
        { '$customer.code$': { [Op.like]: s } },
        { '$invoice.invoiceNumber$': { [Op.like]: s } },
        { '$items.batchNumber$': { [Op.like]: s } }
      ];
    }

    const returns = await ReturnRequest.findAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: Invoice, as: 'invoice' },
        { model: User, as: 'salesman', attributes: ['id', 'name', 'email', 'role'] },
        { model: ReturnItem, as: 'items', include: [{ model: Product, as: 'product' }] }
      ],
      order: [['createdAt', 'DESC']],
      subQuery: false
    });

    res.json({ success: true, count: returns.length, data: returns });
  } catch (error) {
    console.error('Get Returns error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. GET RETURN DETAILS BY ID
exports.getReturnById = async (req, res) => {
  try {
    const returnReq = await ReturnRequest.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Invoice, as: 'invoice' },
        { model: User, as: 'salesman', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'qcInspector', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name', 'email', 'role'] },
        { model: ReturnItem, as: 'items', include: [{ model: Product, as: 'product' }] }
      ]
    });


    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found' });
    }

    res.json({ success: true, data: returnReq });
  } catch (error) {
    console.error('Get Return Details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. APPROVE / REJECT RMA
exports.approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body; // action: 'Approve' | 'Reject'

    const returnReq = await ReturnRequest.findByPk(id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found' });
    }

    if (action === 'Reject') {
      returnReq.status = 'Rejected';
      returnReq.kanbanColumn = 'Closed';
      returnReq.qcRemarks = remarks || 'RMA Rejected by manager';
      await returnReq.save();
      return res.json({ success: true, message: 'Return Request rejected', data: returnReq });
    }

    returnReq.status = 'Approved';
    returnReq.kanbanColumn = 'Approved';
    returnReq.warehouseZone = 'Receiving';
    await returnReq.save();

    invalidateReturnsCache();

    res.json({ success: true, message: 'Return Request Approved (RMA Active)', data: returnReq });
  } catch (error) {
    console.error('Approve Return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5B. RECEIVE RETURN (SIMPLE BUSINESS WORKFLOW)
exports.receiveReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      productCondition = 'Good', // 'Good', 'Damaged', 'Expired', 'Not Resalable'
      remarks
    } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }],
      transaction: t
    });

    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return Request not found.' });
    }

    if (returnReq.status === 'Cancelled') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Cannot receive a cancelled return.' });
    }

    if (returnReq.status === 'Received' || returnReq.status === 'Refund Pending' || returnReq.status === 'Replacement Pending' || returnReq.status === 'Completed' || returnReq.status === 'Refunded') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Product has already been received.' });
    }

    // Atomic Stock Update with Idempotency Protection
    if (!returnReq.stockUpdated) {
      if (productCondition === 'Good') {
        for (const item of returnReq.items) {
          const prod = await Product.findByPk(item.productId, { transaction: t });
          if (prod) {
            const addQty = parseFloat(item.quantity || 0);
            prod.stock = parseFloat(prod.stock || 0) + addQty;
            await prod.save({ transaction: t });

            await StockMovement.create({
              productId: prod.id,
              type: 'IN',
              quantity: addQty,
              batchNumber: item.batchNumber || null,
              reason: `Customer Return #${returnReq.rmaNumber} - Good Condition`,
              referenceId: returnReq.id,
              referenceType: 'ReturnRequest',
              date: new Date()
            }, { transaction: t });
          }
        }
      } else {
        // Damaged, Expired, Not Resalable -> Do NOT add to sellable stock; record in StockLoss
        for (const item of returnReq.items) {
          await StockLoss.create({
            productId: item.productId,
            batchNumber: item.batchNumber || null,
            quantity: item.quantity,
            costValue: (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1),
            reason: `Return #${returnReq.rmaNumber} (${productCondition}): ${remarks || returnReq.returnReason}`,
            dispositionCategory: productCondition === 'Expired' ? 'Expired' : 'Destroyed',
            approvedBy: req.user ? req.user.id : null,
          }, { transaction: t });
        }
      }
      returnReq.stockUpdated = true;
    }

    returnReq.productCondition = productCondition;
    if (remarks) {
      returnReq.qcRemarks = remarks;
    }
    returnReq.receivedAt = new Date();

    // Set next status based on returnType
    const nextStatus = (returnReq.returnType === 'Replacement') ? 'Replacement Pending' : 'Refund Pending';
    returnReq.status = nextStatus;
    returnReq.kanbanColumn = 'Received';

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Return #${returnReq.rmaNumber} marked as received. Stock ${productCondition === 'Good' ? 'restored to available inventory' : 'marked as non-sellable'}.`,
      data: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Receive Return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5C. PROCESS REFUND
exports.processRefund = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { refundMethod, refundAmount } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, { transaction: t });
    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return Request not found.' });
    }

    if (returnReq.refundStatus === 'Refunded' || returnReq.status === 'Completed' || returnReq.status === 'Refunded') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Refund has already been processed.' });
    }

    const amt = parseFloat(refundAmount !== undefined ? refundAmount : (returnReq.refundAmount || returnReq.totalValue || 0));
    const method = refundMethod || returnReq.refundMethod || 'Original Payment Method';

    // If Credit / Customer Balance, adjust customer balance safely
    if (method === 'Credit / Customer Balance' && returnReq.customerId) {
      const cust = await Customer.findByPk(returnReq.customerId, { transaction: t });
      if (cust) {
        cust.balance = Math.max(0, Number(cust.balance || 0) - amt);
        await cust.save({ transaction: t });
      }
    }

    returnReq.refundAmount = amt;
    returnReq.refundMethod = method;
    returnReq.refundStatus = 'Refunded';
    returnReq.refundedAt = new Date();
    returnReq.status = 'Completed';
    returnReq.completedAt = new Date();
    returnReq.kanbanColumn = 'Closed';

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Refund of ₹${amt.toLocaleString('en-IN')} processed successfully via ${method}.`,
      data: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Process Refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5D. PROCESS REPLACEMENT
exports.processReplacement = async (req, res) => {
  try {
    const { id } = req.params;
    const returnReq = await ReturnRequest.findByPk(id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found.' });
    }

    if (returnReq.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Replacement has already been processed.' });
    }

    returnReq.status = 'Completed';
    returnReq.completedAt = new Date();
    returnReq.kanbanColumn = 'Closed';
    await returnReq.save();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Replacement processed and return #${returnReq.rmaNumber} marked as completed.`,
      data: returnReq
    });
  } catch (error) {
    console.error('Process Replacement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5E. CANCEL RETURN
exports.cancelReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }],
      transaction: t
    });

    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return Request not found.' });
    }

    if (returnReq.status === 'Completed' || returnReq.status === 'Refunded') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Cannot cancel an already completed return.' });
    }

    // If stock was previously incremented with Good condition, reverse it atomically
    if (returnReq.stockUpdated && returnReq.productCondition === 'Good') {
      for (const item of returnReq.items) {
        const prod = await Product.findByPk(item.productId, { transaction: t });
        if (prod) {
          const rollbackQty = parseFloat(item.quantity || 0);
          prod.stock = Math.max(0, parseFloat(prod.stock || 0) - rollbackQty);
          await prod.save({ transaction: t });

          await StockMovement.create({
            productId: prod.id,
            type: 'OUT',
            quantity: rollbackQty,
            batchNumber: item.batchNumber || null,
            reason: `Return Cancelled #${returnReq.rmaNumber} - Stock Rollback`,
            referenceId: returnReq.id,
            referenceType: 'ReturnRequest',
            date: new Date()
          }, { transaction: t });
        }
      }
      returnReq.stockUpdated = false;
    }

    returnReq.status = 'Cancelled';
    returnReq.kanbanColumn = 'Closed';
    returnReq.actionTaken = `Cancelled: ${reason || 'User cancelled'}`;

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Return #${returnReq.rmaNumber} has been cancelled.`,
      data: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Cancel Return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. WAREHOUSE RECEIVE & QC INSPECTION WITH MANDATORY DISPOSITION
exports.qcInspect = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      qcRemarks,
      qcInspectorId,
      itemsInspection = [] // array of { itemId, disposition, qcConditionProduct, qcConditionPackage, packagingFailureCategory, qcImages }
    } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }]
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found' });
    }

    returnReq.qcRemarks = qcRemarks || returnReq.qcRemarks;
    returnReq.qcInspectorId = qcInspectorId || req.user?.id || null;
    returnReq.status = 'QC Completed';
    returnReq.kanbanColumn = 'QC Passed';

    // Process individual item dispositions & route stock
    const prodIds = itemsInspection.map(insp => {
      const item = returnReq.items.find(i => i.id === insp.itemId);
      return item ? item.productId : null;
    }).filter(Boolean);
    const { Op } = require('sequelize');
    const products = await Product.findAll({ where: { id: { [Op.in]: prodIds } } });
    const productMap = new Map(products.map(p => [p.id.toString(), p]));

    for (const insp of itemsInspection) {
      const item = returnReq.items.find(i => i.id === insp.itemId);
      if (item) {
        item.disposition = insp.disposition || 'Return to Saleable Stock';
        item.qcConditionProduct = insp.qcConditionProduct || item.qcConditionProduct;
        item.qcConditionPackage = insp.qcConditionPackage || item.qcConditionPackage;
        item.returnedImageUrl = insp.qcImages ? insp.qcImages[0] : item.returnedImageUrl;
        await item.save();

        // ROUTE INVENTORY BASED ON DISPOSITION
        if (insp.disposition === 'Return to Saleable Stock') {
          const prod = productMap.get(item.productId?.toString());
          if (prod) {
            prod.stock = (parseFloat(prod.stock || 0) + parseFloat(item.quantity || 0));
            await prod.save();
          }
        } else if (insp.disposition === 'Route to Repacking') {
          const woNo = await generateWorkOrderNumber();
          await RepackWorkOrder.create({
            workOrderNumber: woNo,
            returnRequestId: returnReq.id,
            productId: item.productId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            packagingMaterialType: 'New Pouches & Outer Box',
            status: 'In Progress',
            warehouseZone: 'Repacking Zone',
          });
          returnReq.warehouseZone = 'Repacking Zone';
          returnReq.kanbanColumn = 'Repacking Queue';
        } else if (insp.disposition === 'Destroy & Write-Off') {
          await StockLoss.create({
            productId: item.productId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            costValue: (item.unitPrice || 0) * (item.quantity || 1),
            reason: 'QC Inspection Failed: Packaging Tearing / Contamination',
            dispositionCategory: 'Destroyed',
            approvedBy: req.user ? req.user.id : null,
          });
          returnReq.warehouseZone = 'Destroyed Zone';
        } else if (insp.disposition === 'Return to Supplier') {
          const claimNo = await generateSupplierClaimNumber();
          await SupplierClaim.create({
            claimNumber: claimNo,
            supplierName: 'Packaging Supplier ABC',
            productId: item.productId,
            batchNumber: item.batchNumber,
            claimAmount: (item.unitPrice || 0) * (item.quantity || 1),
            reason: 'Raw material defect: Seal failure under pressure',
            status: 'Submitted',
          });
          returnReq.warehouseZone = 'RTV Zone';
        }
      }
    }

    await returnReq.save();

    // Auto NCR Generation if quality issue detected
    const totalBatchReturns = await ReturnRequest.count({
      include: [{
        model: ReturnItem,
        as: 'items',
        where: { batchNumber: returnReq.items[0]?.batchNumber || 'ABC240715' }
      }]
    });

    if (totalBatchReturns >= 3) {
      const bNo = returnReq.items[0]?.batchNumber || 'ABC240715';
      const existingNcr = await ManufacturingNcr.findOne({ where: { batchNumber: bNo } });
      if (!existingNcr) {
        const ncrNo = await generateNcrNumber();
        await ManufacturingNcr.create({
          ncrNumber: ncrNo,
          batchNumber: bNo,
          productId: returnReq.items[0]?.productId || 1,
          triggerReturnCount: totalBatchReturns,
          status: 'Open',
          rootCauseCategory: returnReq.rootCause || 'Manufacturing',
          rootCauseDetails: `Auto-generated NCR: ${totalBatchReturns} returns recorded for batch ${bNo}.`,
          correctiveAction: 'Inspect production line and raw material batch receipts.',
          preventiveAction: 'Recalibrate sealing machine and review batch log.'
        });
      }
    }

    // Auto Batch Recall if returns >= 5
    if (totalBatchReturns >= 5) {
      const bNo = returnReq.items[0]?.batchNumber || 'ABC240715';
      const existingRecall = await BatchRecall.findOne({ where: { batchNumber: bNo } });
      if (!existingRecall) {
        await BatchRecall.create({
          batchNumber: bNo,
          productId: returnReq.items[0]?.productId || 1,
          returnCount: totalBatchReturns,
          recallLevel: 'Internal Hold',
          isRecalled: true,
          salesBlocked: true,
          websiteBlocked: true,
          invoiceBlocked: true,
          reason: `AUTOMATIC BATCH RECALL: Threshold exceeded with ${totalBatchReturns} customer returns.`,
        });
      }
    }

    invalidateReturnsCache();

    res.json({
      success: true,
      message: 'QC Inspection completed and stock/disposition processed',
      data: returnReq
    });
  } catch (error) {
    console.error('QC Inspection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. COMPLETE RETURN WORKFLOW & CLOSE
exports.closeReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }]
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found' });
    }

    // Validate mandatory disposition on all items
    const unassigned = returnReq.items.find(i => i.disposition === 'Pending QC');
    if (unassigned) {
      return res.status(400).json({
        success: false,
        message: 'Cannot close Return: All items must have an assigned disposition.'
      });
    }

    returnReq.status = 'Closed';
    returnReq.kanbanColumn = 'Closed';
    await returnReq.save();

    invalidateReturnsCache();

    res.json({ success: true, message: 'Return Request closed successfully', data: returnReq });
  } catch (error) {
    console.error('Close Return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. NEAR-EXPIRY SCANNER & FAST SELLING ENGINE
exports.getNearExpiryScan = async (req, res) => {
  try {
    const products = await Product.findAll();

    const result = products.map(p => {
      const remainingDays = Number(p.shelfLifeDays || 30);
      let action = 'Normal Sale';
      if (remainingDays <= 15) action = 'Factory Outlet / Employee Sale';
      else if (remainingDays <= 30) action = 'Apply Discount Campaign';
      else if (remainingDays <= 45) action = 'Transfer to Fast Selling Shops';
      else if (remainingDays <= 60) action = 'Notify Sales';

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        remainingShelfDays: remainingDays,
        recommendedAction: action,
        suggestedDiscount: remainingDays <= 30 ? '15%' : '5%'
      };
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('Near Expiry Scan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. FAST SELLING SHOPS RECOMMENDATION ENGINE
exports.recommendFastSellingShops = async (req, res) => {
  try {
    const customers = await Customer.findAll({ limit: 10 });

    const ranked = customers.map((c, index) => ({
      customerId: c.id,
      customerName: c.name || `Store #${c.id}`,
      customerType: c.customerType || 'Retail Shop',
      salesVolumeMonthly: 0,
      repeatFrequencyScore: 0,
      distanceKm: 0,
      rank: index + 1,
      recommendation: `Recommended Store #${index + 1}`
    }));

    res.json({ success: true, count: ranked.length, data: ranked });
  } catch (error) {
    console.error('Recommend Fast Selling Shops error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. REPACK WORK ORDERS APIS
exports.getRepackWorkOrders = async (req, res) => {
  try {
    const orders = await RepackWorkOrder.findAll({
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeRepackWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const wo = await RepackWorkOrder.findByPk(id);
    if (!wo) {
      return res.status(404).json({ success: false, message: 'Work Order not found' });
    }

    wo.status = 'Completed';
    wo.qcApproved = true;
    await wo.save();

    const prod = await Product.findByPk(wo.productId);
    if (prod) {
      prod.stock = (parseFloat(prod.stock || 0) + parseFloat(wo.quantity || 0));
      await prod.save();
    }

    invalidateReturnsCache();
    res.json({ success: true, message: 'Repack Work Order completed & stock moved to Finished Goods', data: wo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. NCR & CAPA APIS
exports.getNcrs = async (req, res) => {
  try {
    const ncrs = await ManufacturingNcr.findAll({
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: ncrs.length, data: ncrs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. BATCH RECALLS APIS
exports.getBatchRecalls = async (req, res) => {
  try {
    const recalls = await BatchRecall.findAll({
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: recalls.length, data: recalls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 13. AI PREDICTIONS & INSIGHTS ENGINE
exports.getAiInsights = async (req, res) => {
  try {
    const insights = await ReturnAiInsight.findAll({
      where: { status: 'Active' },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: insights.length, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 14. EXECUTIVE DASHBOARD & METRICS API (CACHED 45s)
let metricsCache = null;
let metricsCacheTimestamp = 0;
const CACHE_TTL_MS = 45000;

function invalidateReturnsCache() {
  metricsCache = null;
  metricsCacheTimestamp = 0;
}
exports.invalidateReturnsCache = invalidateReturnsCache;

exports.getDashboardMetrics = async (req, res) => {
  try {
    const forceRefresh = req.query?.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && metricsCache && (now - metricsCacheTimestamp < CACHE_TTL_MS)) {
      return res.json(metricsCache);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todaysReturnsCount,
      totalReturnsCount,
      pendingQc,
      repackingCount,
      ncrCount,
      recallCount,
      creditNotesCount,
      allReturns,
      returnRequestsCount,
      toReceiveCount,
      toRefundCount,
      completedCount
    ] = await Promise.all([
      ReturnRequest.count({ where: { createdAt: { [Op.gte]: today } } }),
      ReturnRequest.count(),
      ReturnRequest.count({ where: { status: { [Op.in]: ['Requested', 'Pending QC', 'QC Pending'] } } }),
      RepackWorkOrder.count({ where: { status: 'In Progress' } }),
      ManufacturingNcr.count({ where: { status: 'Open' } }),
      BatchRecall.count({ where: { isRecalled: true } }),
      ReturnCreditNote.count(),
      ReturnRequest.findAll({
        attributes: ['totalValue', 'recoveredValue', 'status', 'returnType', 'rootCause', 'returnReason', 'createdAt']
      }),
      ReturnRequest.count({ where: { status: { [Op.in]: ['Requested', 'Pending QC', 'QC Pending', 'Open'] } } }),
      ReturnRequest.count({ where: { status: { [Op.in]: ['Approved', 'In Transit', 'Pending Receive'] } } }),
      ReturnRequest.count({ where: { status: { [Op.in]: ['Received', 'Refund Pending'] } } }),
      ReturnRequest.count({ where: { status: { [Op.in]: ['Completed', 'Refunded', 'Replaced', 'Closed'] } } })
    ]);

    let totalValSum = 0;
    let totalRecoveredVal = 0;
    let totalLossVal = 0;
    const causeCounts = {};
    const monthlyMap = {};

    allReturns.forEach(r => {
      const val = Number(r.totalValue || 0);
      const gstRec = Number(r.recoveredValue || 0);
      totalValSum += val;
      if (r.returnType === 'Destroy' || r.status === 'Rejected') {
        totalLossVal += val;
      } else {
        totalRecoveredVal += (val + gstRec);
      }

      const cause = r.rootCause || r.returnReason || 'Other';
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;

      if (r.createdAt) {
        const monthLabel = new Date(r.createdAt).toLocaleString('default', { month: 'short' });
        monthlyMap[monthLabel] = (monthlyMap[monthLabel] || 0) + 1;
      }
    });

    const sumTotal = totalRecoveredVal + totalLossVal;
    const recoveryRate = sumTotal > 0 ? Number(((totalRecoveredVal / sumTotal) * 100).toFixed(1)) : 0;
    const lossRate = sumTotal > 0 ? Number(((totalLossVal / sumTotal) * 100).toFixed(1)) : 0;

    const rootCauseChartData = Object.keys(causeCounts).map(name => ({
      name,
      count: causeCounts[name],
      percentage: totalReturnsCount > 0 ? Number(((causeCounts[name] / totalReturnsCount) * 100).toFixed(1)) : 0
    }));

    const monthlyReturnsChartData = Object.keys(monthlyMap).map(month => ({
      month,
      returns: monthlyMap[month]
    }));

    const recoveryTrendChartData = [
      { name: 'Recovered Value', value: totalRecoveredVal },
      { name: 'Loss Value', value: totalLossVal }
    ].filter(item => item.value > 0);

    const payload = {
      success: true,
      summary: {
        returnRequests: returnRequestsCount,
        toReceive: toReceiveCount,
        toRefund: toRefundCount,
        completed: completedCount
      },
      metrics: {
        returnRequests: returnRequestsCount,
        toReceive: toReceiveCount,
        toRefund: toRefundCount,
        completed: completedCount,
        todaysReturns: todaysReturnsCount,
        pendingQc: pendingQc,
        recoveryValue: totalRecoveredVal,
        recoveryRate: recoveryRate,
        activeRecalls: recallCount,
        totalReturns: totalReturnsCount
      },
      charts: {
        rootCause: rootCauseChartData,
        monthlyReturns: monthlyReturnsChartData,
        recoveryTrend: recoveryTrendChartData
      },
      data: {
        todaysReturns: todaysReturnsCount,
        pendingQc: pendingQc,
        repackingQueue: repackingCount,
        stockRestoredVal: totalRecoveredVal,
        transferredVal: Math.round(totalRecoveredVal * 0.35),
        destroyedVal: totalLossVal,
        recoveryPercentage: recoveryRate,
        lossPercentage: lossRate,
        openNcrs: ncrCount,
        activeRecalls: recallCount,
        creditNotes: creditNotesCount,
        totalReturns: totalReturnsCount,
        rootCauseBreakdown: rootCauseChartData
      }
    };

    metricsCache = payload;
    metricsCacheTimestamp = Date.now();

    try {
      await ActivityLog.create({
        action: 'Dashboard Refresh',
        module: 'Returns',
        details: `Returns Dashboard metrics refreshed. Total returns: ${totalReturnsCount}`
      });
    } catch (e) {}

    res.json(payload);
  } catch (error) {
    console.error('Get Dashboard Metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. APPROVE RETURN REQUEST
exports.approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const returnReq = await ReturnRequest.findByPk(id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot approve a cancelled return' });
    }

    if (returnReq.status !== 'Approved' && returnReq.status !== 'Received' && returnReq.status !== 'Completed') {
      returnReq.status = 'Approved';
      returnReq.kanbanColumn = 'Approved';
      returnReq.approvalLevel = req.user?.role || 'Manager';
      await returnReq.save();
      invalidateReturnsCache();
    }

    res.json({
      success: true,
      message: `Return ${returnReq.rmaNumber} approved successfully`,
      data: returnReq,
      returnRequest: returnReq
    });
  } catch (error) {
    console.error('Approve return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.approveReturnRequest = exports.approveReturn;

// 13. RECEIVE RETURN ITEM (INSPECTION & CONDITIONAL RESTOCK)
exports.receiveReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { condition = 'Good', notes = '', warehouseLocation = 'Main Warehouse' } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }],
      transaction: t
    });

    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status === 'Cancelled') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Cannot receive a cancelled return' });
    }

    const itemsToProcess = returnReq.items && returnReq.items.length > 0
      ? returnReq.items
      : [{
          productId: returnReq.replacementProductId,
          quantity: returnReq.totalQty || 1,
          productName: 'Returned Item'
        }];

    // IDEMPOTENCY GUARD: Only update inventory once
    if (!returnReq.stockUpdated) {
      if (condition === 'Good') {
        for (const item of itemsToProcess) {
          if (item.productId) {
            const prod = await Product.findByPk(item.productId, { transaction: t });
            if (prod) {
              const qtyToAdd = Number(item.quantity || 1);
              await prod.increment('stock', { by: qtyToAdd, transaction: t });

              try {
                await StockMovement.create({
                  productId: item.productId,
                  type: 'IN',
                  quantity: qtyToAdd,
                  reason: `Customer Return Restock (${returnReq.rmaNumber})`,
                  referenceId: returnReq.id,
                  createdById: req.user ? req.user.id : null
                }, { transaction: t });
              } catch (smErr) {
                console.warn('StockMovement log error:', smErr.message);
              }
            }
          }
        }
      } else {
        // Damaged, Expired, or Not Resalable -> Log to StockLoss, do NOT add to sellable stock
        for (const item of itemsToProcess) {
          try {
            await StockLoss.create({
              itemType: 'Product',
              productId: item.productId,
              quantity: Number(item.quantity || 1),
              reason: `${condition} Return`,
              unitCost: Number(item.unitPrice || 0),
              totalLossValue: Number(item.quantity || 1) * Number(item.unitPrice || 0),
              notes: `Customer Return (${returnReq.rmaNumber}) - ${condition}`,
              createdById: req.user ? req.user.id : null
            }, { transaction: t });
          } catch (slErr) {
            console.warn('StockLoss log error:', slErr.message);
          }
        }
      }
      returnReq.stockUpdated = true;
    }

    returnReq.productCondition = condition;
    returnReq.receivedAt = new Date();
    returnReq.warehouseId = warehouseLocation || returnReq.warehouseId;
    if (notes) {
      returnReq.qcRemarks = returnReq.qcRemarks ? `${returnReq.qcRemarks}\n[Receipt] ${notes}` : `[Receipt] ${notes}`;
    }

    // Set next status based on actionType / returnType
    const action = (returnReq.returnType || '').toLowerCase();
    if (action.includes('replacement')) {
      returnReq.status = 'Replacement Pending';
      returnReq.kanbanColumn = 'Replacement Pending';
    } else {
      returnReq.status = 'Refund Pending';
      returnReq.kanbanColumn = 'Refund Pending';
    }

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Return ${returnReq.rmaNumber} marked as received (${condition} Condition)`,
      data: returnReq,
      returnRequest: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Receive return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 14. PROCESS REFUND
exports.processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, refundMethod, referenceNumber, notes } = req.body;

    const returnReq = await ReturnRequest.findByPk(id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot refund a cancelled return' });
    }

    const finalRefundAmount = refundAmount !== undefined ? Number(refundAmount) : Number(returnReq.refundAmount || returnReq.totalValue || 0);
    returnReq.refundAmount = finalRefundAmount;
    returnReq.refundMethod = refundMethod || returnReq.refundMethod || 'Original Payment Method';
    returnReq.refundStatus = 'Completed';
    returnReq.refundedAt = new Date();
    returnReq.completedAt = new Date();
    returnReq.status = 'Completed';
    returnReq.kanbanColumn = 'Completed';

    if (notes || referenceNumber) {
      const refNote = referenceNumber ? `Ref #${referenceNumber}. ` : '';
      const fullNote = `${refNote}${notes || ''}`.trim();
      returnReq.qcRemarks = returnReq.qcRemarks ? `${returnReq.qcRemarks}\n[Refund] ${fullNote}` : `[Refund] ${fullNote}`;
    }

    await returnReq.save();
    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Refund of ₹${finalRefundAmount} processed for ${returnReq.rmaNumber}`,
      data: returnReq,
      returnRequest: returnReq
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 15. PROCESS REPLACEMENT
exports.processReplacement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { replacementProductId, replacementQuantity = 1, notes, dispatchTracking } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, { transaction: t });
    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status === 'Cancelled') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Cannot process replacement for a cancelled return' });
    }

    const prodId = replacementProductId || returnReq.replacementProductId;
    const qty = Number(replacementQuantity || returnReq.replacementQuantity || 1);

    if (prodId) {
      const repProd = await Product.findByPk(prodId, { transaction: t });
      if (repProd) {
        await repProd.decrement('stock', { by: qty, transaction: t });
        try {
          await StockMovement.create({
            productId: prodId,
            type: 'OUT',
            quantity: qty,
            reason: `Replacement for Customer Return (${returnReq.rmaNumber})`,
            referenceId: returnReq.id,
            createdById: req.user ? req.user.id : null
          }, { transaction: t });
        } catch (smErr) {
          console.warn('StockMovement replacement log error:', smErr.message);
        }
      }
    }

    returnReq.replacementProductId = prodId;
    returnReq.replacementQuantity = qty;
    returnReq.status = 'Completed';
    returnReq.kanbanColumn = 'Completed';
    returnReq.completedAt = new Date();

    if (notes || dispatchTracking) {
      const trackNote = dispatchTracking ? `Tracking: ${dispatchTracking}. ` : '';
      const fullNote = `${trackNote}${notes || ''}`.trim();
      returnReq.qcRemarks = returnReq.qcRemarks ? `${returnReq.qcRemarks}\n[Replacement] ${fullNote}` : `[Replacement] ${fullNote}`;
    }

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Replacement processed successfully for ${returnReq.rmaNumber}`,
      data: returnReq,
      returnRequest: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Process replacement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 16. CANCEL RETURN
exports.cancelReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const returnReq = await ReturnRequest.findByPk(id, {
      include: [{ model: ReturnItem, as: 'items' }],
      transaction: t
    });

    if (!returnReq) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status === 'Cancelled') {
      await t.rollback();
      return res.json({ success: true, message: 'Return is already cancelled', data: returnReq });
    }

    // Rollback restocked inventory if it was already marked received in Good condition
    if (returnReq.stockUpdated && returnReq.productCondition === 'Good') {
      const itemsToRevert = returnReq.items && returnReq.items.length > 0 ? returnReq.items : [];
      for (const item of itemsToRevert) {
        if (item.productId) {
          const prod = await Product.findByPk(item.productId, { transaction: t });
          if (prod) {
            const qty = Number(item.quantity || 1);
            await prod.decrement('stock', { by: qty, transaction: t });
            try {
              await StockMovement.create({
                productId: item.productId,
                type: 'OUT',
                quantity: qty,
                reason: `Cancelled Return Stock Reversal (${returnReq.rmaNumber})`,
                referenceId: returnReq.id,
                createdById: req.user ? req.user.id : null
              }, { transaction: t });
            } catch (smErr) {}
          }
        }
      }
      returnReq.stockUpdated = false;
    }

    returnReq.status = 'Cancelled';
    returnReq.kanbanColumn = 'Cancelled';
    returnReq.qcRemarks = returnReq.qcRemarks ? `${returnReq.qcRemarks}\n[Cancelled] ${reason}` : `[Cancelled] ${reason}`;

    await returnReq.save({ transaction: t });
    await t.commit();

    invalidateReturnsCache();

    res.json({
      success: true,
      message: `Return ${returnReq.rmaNumber} has been cancelled`,
      data: returnReq,
      returnRequest: returnReq
    });
  } catch (error) {
    await t.rollback();
    console.error('Cancel return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

