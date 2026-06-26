const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const ExcelJS = require('exceljs');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Shipment = require('../models/Shipment');
const InvoiceItem = require('../models/InvoiceItem');
const Supplier = require('../models/Supplier');
const { getStateCodeByName, isValidGstin, roundMoney } = require('../utils/gst');

const sendExcel = async (res, workbook, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  await workbook.xlsx.write(res);
  res.end();
};

const sendCsv = (res, rows, filename) => {
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].filter(Boolean);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(lines.join('\n'));
};

const formatReportDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const formatMonthLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
};

const buildPurchaseGstQuery = ({ from, to, supplierId, supplier, gstNumber, state, gstType } = {}) => {
  const query = {};

  // Exclude unregistered suppliers
  if (gstType) {
    if (gstType === 'Unregistered') {
      query.supplierGstType = 'NONE_MATCH';
    } else {
      query.supplierGstType = gstType;
    }
  } else {
    query.supplierGstType = { [Op.and]: [{ [Op.ne]: 'Unregistered' }, { [Op.ne]: null }, { [Op.ne]: '' }] };
  }

  if (gstNumber) {
    query.supplierGstNumber = { [Op.and]: [{ [Op.like]: `%${gstNumber}%` }, { [Op.ne]: null }, { [Op.ne]: '' }] };
  } else {
    query.supplierGstNumber = { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] };
  }

  if (from || to) {
    query.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      query.date[Op.gte] = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.date[Op.lte] = end;
    }
  }

  const resolvedSupplier = supplierId || supplier;
  if (resolvedSupplier) {
    if (/^\d+$/.test(String(resolvedSupplier))) {
      query.supplierId = Number(resolvedSupplier);
    } else {
      query.supplier = { [Op.like]: `%${resolvedSupplier}%` };
    }
  }

  if (state) {
    const trimmed = String(state).trim();
    const stateCode = /^\d{2}$/.test(trimmed) ? trimmed : getStateCodeByName(trimmed);
    if (stateCode) {
      query.supplierStateCode = stateCode;
    } else {
      query.supplierState = trimmed;
    }
  }

  return query;
};

const purchaseGstInclude = [
  {
    model: Supplier,
    as: 'supplierRelation',
    attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType', 'panNumber', 'tdsApplicable'],
  },
  {
    model: PurchaseItem,
    as: 'items',
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku', 'gstPercent'],
      },
    ],
  },
];

const mapPurchaseGstRow = (purchase) => {
  const items = (purchase.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const taxableAmount = roundMoney(qty * unitPrice);
    const taxAmount = roundMoney(item.taxAmount !== undefined && item.taxAmount !== null ? Number(item.taxAmount) : Number(item.lineTotal || 0) - taxableAmount);
    return {
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || item.name || '',
      sku: item.product?.sku || '',
      qty,
      unitPrice,
      gstPercent: item.gstPercent !== undefined && item.gstPercent !== null ? Number(item.gstPercent) : Number(item.product?.gstPercent || 0),
      taxableAmount,
      taxAmount,
      cgstAmount: roundMoney(item.cgstAmount || 0),
      sgstAmount: roundMoney(item.sgstAmount || 0),
      igstAmount: roundMoney(item.igstAmount || 0),
      lineTotal: roundMoney(item.lineTotal || taxableAmount + taxAmount),
    };
  });

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    supplierId: purchase.supplierId,
    supplier: purchase.supplier || purchase.supplierRelation?.name || 'Unknown',
    supplierGstNumber: purchase.supplierGstNumber || purchase.supplierRelation?.gstNumber || '',
    supplierGstType: purchase.supplierGstType || purchase.supplierRelation?.gstRegistrationType || '',
    supplierState: purchase.supplierState || purchase.supplierRelation?.state || '',
    supplierStateCode: purchase.supplierStateCode || purchase.supplierRelation?.stateCode || '',
    supplierPanNumber: purchase.supplierPanNumber || purchase.supplierRelation?.panNumber || '',
    supplierTdsApplicable: Boolean(purchase.supplierTdsApplicable),
    invoiceNumber: purchase.invoiceNumber || '',
    invoiceDate: purchase.invoiceDate || purchase.date,
    taxableAmount: roundMoney(purchase.taxableValue || purchase.subtotal || 0),
    cgstAmount: roundMoney(purchase.cgstAmount || 0),
    sgstAmount: roundMoney(purchase.sgstAmount || 0),
    igstAmount: roundMoney(purchase.igstAmount || 0),
    gstTotal: roundMoney(purchase.taxTotal || 0),
    grandTotal: roundMoney(purchase.total || 0),
    taxType: purchase.taxType || 'No GST',
    taxRate: Number(purchase.taxRate || 0),
    invoicePdfPath: purchase.invoicePdfPath || '',
    invoicePdfName: purchase.invoicePdfName || '',
    invoicePdfMimeType: purchase.invoicePdfMimeType || '',
    paymentStatus: purchase.paymentStatus,
    dueDate: purchase.dueDate,
    notes: purchase.notes || '',
    date: purchase.date,
    items,
  };
};

const buildSupplierKey = (row) => `${row.supplierId || row.supplier || row.supplierGstNumber || 'supplier'}::${row.supplierGstNumber || row.supplier}`;

const summarizePurchaseGstRows = (rows) => rows.reduce(
  (acc, row) => {
    acc.purchaseCount += 1;
    acc.totalPurchaseValue = roundMoney(acc.totalPurchaseValue + row.taxableAmount);
    acc.totalGSTPaid = roundMoney(acc.totalGSTPaid + row.gstTotal);
    acc.cgstCredit = roundMoney(acc.cgstCredit + row.cgstAmount);
    acc.sgstCredit = roundMoney(acc.sgstCredit + row.sgstAmount);
    acc.igstCredit = roundMoney(acc.igstCredit + row.igstAmount);
    acc.totalITCAvailable = roundMoney(acc.totalITCAvailable + row.gstTotal);
    if (row.invoicePdfPath) {
      acc.pdfCount += 1;
    }
    return acc;
  },
  {
    purchaseCount: 0,
    totalPurchaseValue: 0,
    totalGSTPaid: 0,
    cgstCredit: 0,
    sgstCredit: 0,
    igstCredit: 0,
    totalITCAvailable: 0,
    pdfCount: 0,
  }
);

const buildMonthlySummary = (rows) => {
  const monthlyMap = new Map();

  rows.forEach((row) => {
    const date = new Date(row.invoiceDate || row.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthlyMap.get(key) || {
      key,
      month: formatMonthLabel(date),
      purchaseAmount: 0,
      gstPaid: 0,
      inputCredit: 0,
      cgstCredit: 0,
      sgstCredit: 0,
      igstCredit: 0,
      purchaseCount: 0,
    };

    existing.purchaseAmount = roundMoney(existing.purchaseAmount + row.taxableAmount);
    existing.gstPaid = roundMoney(existing.gstPaid + row.gstTotal);
    existing.inputCredit = roundMoney(existing.inputCredit + row.gstTotal);
    existing.cgstCredit = roundMoney(existing.cgstCredit + row.cgstAmount);
    existing.sgstCredit = roundMoney(existing.sgstCredit + row.sgstAmount);
    existing.igstCredit = roundMoney(existing.igstCredit + row.igstAmount);
    existing.purchaseCount += 1;
    monthlyMap.set(key, existing);
  });

  return [...monthlyMap.values()].sort((a, b) => a.key.localeCompare(b.key));
};

const buildSupplierSummary = (rows) => {
  const supplierMap = new Map();

  rows.forEach((row) => {
    const key = buildSupplierKey(row);
    const existing = supplierMap.get(key) || {
      key,
      supplierId: row.supplierId,
      supplier: row.supplier,
      gstNumber: row.supplierGstNumber,
      gstType: row.supplierGstType,
      state: row.supplierState,
      stateCode: row.supplierStateCode,
      purchaseAmount: 0,
      gstPaid: 0,
      cgstCredit: 0,
      sgstCredit: 0,
      igstCredit: 0,
      purchaseCount: 0,
      lastPurchaseDate: null,
    };

    existing.purchaseAmount = roundMoney(existing.purchaseAmount + row.taxableAmount);
    existing.gstPaid = roundMoney(existing.gstPaid + row.gstTotal);
    existing.cgstCredit = roundMoney(existing.cgstCredit + row.cgstAmount);
    existing.sgstCredit = roundMoney(existing.sgstCredit + row.sgstAmount);
    existing.igstCredit = roundMoney(existing.igstCredit + row.igstAmount);
    existing.purchaseCount += 1;

    const purchaseDate = new Date(row.invoiceDate || row.date);
    if (!Number.isNaN(purchaseDate.getTime())) {
      if (!existing.lastPurchaseDate || purchaseDate > new Date(existing.lastPurchaseDate)) {
        existing.lastPurchaseDate = purchaseDate.toISOString();
      }
    }

    supplierMap.set(key, existing);
  });

  return [...supplierMap.values()].sort((a, b) => b.gstPaid - a.gstPaid || b.purchaseAmount - a.purchaseAmount);
};

const buildProductSummary = (rows) => {
  const productMap = new Map();

  rows.forEach((row) => {
    row.items.forEach((item) => {
      const key = `${item.productId || item.productName || item.sku || item.id}`;
      const existing = productMap.get(key) || {
        key,
        productId: item.productId,
        productName: item.productName || item.name || 'Unknown',
        sku: item.sku || '',
        gstPercent: Number(item.gstPercent || 0),
        quantity: 0,
        purchaseAmount: 0,
        gstPaid: 0,
        purchaseCount: 0,
      };

      existing.quantity = roundMoney(existing.quantity + item.qty);
      existing.purchaseAmount = roundMoney(existing.purchaseAmount + item.taxableAmount);
      existing.gstPaid = roundMoney(existing.gstPaid + item.taxAmount);
      existing.purchaseCount += 1;
      productMap.set(key, existing);
    });
  });

  return [...productMap.values()].sort((a, b) => b.gstPaid - a.gstPaid || b.purchaseAmount - a.purchaseAmount);
};

const buildReconciliationReport = (rows) => {
  const missingGstNumber = [];
  const duplicateInvoiceMap = new Map();
  const invalidGstin = [];
  const gstMismatches = [];
  const missingInvoiceNumber = [];

  rows.forEach((row) => {
    const supplierGstType = String(row.supplierGstType || '').trim();
    const gstNumber = String(row.supplierGstNumber || '').trim().toUpperCase();
    const invoiceNumber = String(row.invoiceNumber || '').trim();
    const supplierKey = buildSupplierKey(row);

    if (!invoiceNumber) {
      missingInvoiceNumber.push({
        purchaseNumber: row.purchaseNumber,
        supplier: row.supplier,
        invoiceNumber: '',
        date: row.invoiceDate || row.date,
      });
    }

    if (['Regular', 'Composition', 'SEZ'].includes(supplierGstType) && !gstNumber) {
      missingGstNumber.push({
        purchaseNumber: row.purchaseNumber,
        supplier: row.supplier,
        gstType: supplierGstType,
        invoiceNumber,
      });
    }

    if (gstNumber && !isValidGstin(gstNumber)) {
      invalidGstin.push({
        purchaseNumber: row.purchaseNumber,
        supplier: row.supplier,
        gstNumber,
        invoiceNumber,
      });
    }

    if (invoiceNumber) {
      const duplicateKey = `${supplierKey}::${invoiceNumber.toLowerCase()}`;
      const existing = duplicateInvoiceMap.get(duplicateKey) || [];
      existing.push({
        purchaseNumber: row.purchaseNumber,
        supplier: row.supplier,
        invoiceNumber,
        date: row.invoiceDate || row.date,
      });
      duplicateInvoiceMap.set(duplicateKey, existing);
    }

    const supplierStateCode = String(row.supplierStateCode || '').trim().padStart(2, '0');
    const companyStateCode = String(row.companyStateCode || '').trim().padStart(2, '0');
    const expectedTaxType = supplierStateCode && companyStateCode && supplierStateCode === companyStateCode
      ? 'CGST + SGST'
      : 'IGST';

    if (row.gstTotal > 0 && row.taxType && row.taxType !== expectedTaxType) {
      gstMismatches.push({
        issueType: 'TAX_TYPE_MISMATCH',
        purchaseNumber: row.purchaseNumber,
        supplier: row.supplier,
        invoiceNumber,
        expectedTaxType,
        actualTaxType: row.taxType,
      });
    }

    row.items.forEach((item) => {
      const productGst = Number(item.product?.gstPercent || 0);
      const actualGst = Number(item.gstPercent || 0);
      const diff = Math.abs(productGst - actualGst);

      if (productGst > 0 && diff > 0.1) {
        gstMismatches.push({
          issueType: 'GST_PERCENT_MISMATCH',
          purchaseNumber: row.purchaseNumber,
          supplier: row.supplier,
          invoiceNumber,
          product: item.productName || item.name || 'Unknown',
          expectedGstPercent: productGst,
          actualGstPercent: actualGst,
          difference: roundMoney(diff),
        });
      }
    });
  });

  const duplicateInvoice = [...duplicateInvoiceMap.values()].filter((group) => group.length > 1);

  return {
    missingGstNumber,
    duplicateInvoice,
    invalidGstin,
    gstMismatches,
    missingInvoiceNumber,
    summary: {
      missingGstNumber: missingGstNumber.length,
      duplicateInvoice: duplicateInvoice.length,
      invalidGstin: invalidGstin.length,
      gstMismatches: gstMismatches.length,
      missingInvoiceNumber: missingInvoiceNumber.length,
    },
  };
};

const loadPurchaseGstRows = async (filters = {}) => {
  const purchases = await Purchase.findAll({
    where: buildPurchaseGstQuery(filters),
    include: purchaseGstInclude,
    order: [['date', 'DESC'], ['id', 'DESC']],
  });

  return purchases.map(mapPurchaseGstRow);
};

exports.salesReport = async (req, res, next) => {
  try {
    const { from, to, includeLive, includeHistorical } = req.query;
    const query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date[Op.gte] = new Date(from);
      if (to) query.date[Op.lte] = new Date(to);
    }

    const incLive = includeLive === undefined ? true : includeLive === 'true' || includeLive === true;
    const incHist = includeHistorical === undefined ? true : includeHistorical === 'true' || includeHistorical === true;

    if (incLive && !incHist) {
      query.is_historical_data = { [Op.ne]: true };
    } else if (!incLive && incHist) {
      query.is_historical_data = true;
    } else if (!incLive && !incHist) {
      query.id = -1; // return empty
    }
    const sales = await Invoice.findAll({
      where: query,
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'customerCode'] }],
      order: [['date', 'DESC']],
    });

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sales Report');
      ws.columns = [
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Total', key: 'grandTotal', width: 12 },
        { header: 'Status', key: 'paymentStatus', width: 12 },
      ];
      sales.forEach((s) =>
        ws.addRow({
          invoiceNumber: s.invoiceNumber,
          customer: s.customer?.name,
          date: s.date.toISOString().split('T')[0],
          grandTotal: Number(s.grandTotal),
          paymentStatus: s.paymentStatus,
        })
      );
      return sendExcel(res, wb, 'sales-report.xlsx');
    }

    res.json({
      sales,
      count: sales.length,
      total: sales.reduce((sum, item) => sum + Number(item.grandTotal), 0),
    });
  } catch (err) {
    next(err);
  }
};

exports.purchasesReport = async (req, res, next) => {
  try {
    const { from, to, supplierId, supplier, gstNumber, state, gstType } = req.query;
    const query = {};

    if (from || to) {
      query.date = {};
      if (from) query.date[Op.gte] = new Date(from);
      if (to) query.date[Op.lte] = new Date(to);
    }

    const resolvedSupplier = supplierId || supplier;
    if (resolvedSupplier) {
      if (/^\d+$/.test(String(resolvedSupplier))) {
        query.supplierId = Number(resolvedSupplier);
      } else {
        query.supplier = { [Op.like]: `%${resolvedSupplier}%` };
      }
    }

    if (gstNumber) {
      query.supplierGstNumber = { [Op.like]: `%${gstNumber}%` };
    }

    if (state) {
      query.supplierState = state;
    }

    if (gstType) {
      query.supplierGstType = gstType;
    }

    const purchases = await Purchase.findAll({
      where: query,
      include: [
        {
          model: Supplier,
          as: 'supplierRelation',
          attributes: ['id', 'name', 'gstNumber', 'state', 'stateCode', 'gstRegistrationType', 'panNumber'],
        },
      ],
      order: [['date', 'DESC']],
    });

    const mappedPurchases = purchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplierId: purchase.supplierId,
      supplier: purchase.supplier || purchase.supplierRelation?.name || 'Unknown',
      supplierGstNumber: purchase.supplierGstNumber || purchase.supplierRelation?.gstNumber || '',
      supplierState: purchase.supplierState || purchase.supplierRelation?.state || '',
      supplierStateCode: purchase.supplierStateCode || purchase.supplierRelation?.stateCode || '',
      supplierGstType: purchase.supplierGstType || purchase.supplierRelation?.gstRegistrationType || '',
      supplierPanNumber: purchase.supplierPanNumber || purchase.supplierRelation?.panNumber || '',
      date: purchase.date,
      subtotal: Number(purchase.subtotal || 0),
      taxTotal: Number(purchase.taxTotal || 0),
      cgstAmount: Number(purchase.cgstAmount || 0),
      sgstAmount: Number(purchase.sgstAmount || 0),
      igstAmount: Number(purchase.igstAmount || 0),
      taxType: purchase.taxType || 'No GST',
      total: Number(purchase.total || 0),
      paymentStatus: purchase.paymentStatus,
      notes: purchase.notes || '',
    }));
    
    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Purchases Report');
      ws.columns = [
        { header: 'PO #', key: 'purchaseNumber', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'GST Number', key: 'supplierGstNumber', width: 20 },
        { header: 'State', key: 'supplierState', width: 18 },
        { header: 'GST Type', key: 'supplierGstType', width: 18 },
        { header: 'Tax Type', key: 'taxType', width: 16 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 12 },
        { header: 'Tax', key: 'taxTotal', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Status', key: 'paymentStatus', width: 12 },
      ];
      mappedPurchases.forEach((p) =>
        ws.addRow({
          purchaseNumber: p.purchaseNumber,
          supplier: p.supplier,
          supplierGstNumber: p.supplierGstNumber,
          supplierState: p.supplierState,
          supplierGstType: p.supplierGstType,
          taxType: p.taxType,
          date: p.date ? p.date.toISOString().split('T')[0] : '',
          subtotal: p.subtotal,
          taxTotal: p.taxTotal,
          total: p.total,
          paymentStatus: p.paymentStatus,
        })
      );
      return sendExcel(res, wb, 'purchases-report.xlsx');
    }
    
    res.json({
      purchases: mappedPurchases,
      count: mappedPurchases.length,
      total: mappedPurchases.reduce((sum, item) => sum + Number(item.total || 0), 0),
    });
  } catch (err) {
    next(err);
  }
};

exports.purchaseGstRegister = async (req, res, next) => {
  try {
    const purchases = await loadPurchaseGstRows(req.query);
    const summary = summarizePurchaseGstRows(purchases);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Purchase GST Register');
      ws.columns = [
        { header: 'Supplier Name', key: 'supplierName', width: 25 },
        { header: 'GST Number', key: 'gstNumber', width: 20 },
        { header: 'Invoice No', key: 'invoiceNo', width: 18 },
        { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
        { header: 'Taxable Value', key: 'taxableValue', width: 15 },
        { header: 'CGST', key: 'cgst', width: 12 },
        { header: 'SGST', key: 'sgst', width: 12 },
        { header: 'IGST', key: 'igst', width: 12 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
      ];

      purchases.forEach((purchase) =>
        ws.addRow({
          supplierName: purchase.supplier,
          gstNumber: purchase.supplierGstNumber || '',
          invoiceNo: purchase.invoiceNumber || '',
          invoiceDate: formatReportDate(purchase.invoiceDate || purchase.date),
          taxableValue: purchase.taxableAmount,
          cgst: purchase.cgstAmount,
          sgst: purchase.sgstAmount,
          igst: purchase.igstAmount,
          totalAmount: purchase.grandTotal,
        })
      );

      return sendExcel(res, wb, 'purchase-gst-register.xlsx');
    }

    if (req.query.export === 'csv') {
      const csvRows = purchases.map((purchase) => ({
        'Supplier Name': purchase.supplier,
        'GST Number': purchase.supplierGstNumber || '',
        'Invoice No': purchase.invoiceNumber || '',
        'Invoice Date': formatReportDate(purchase.invoiceDate || purchase.date),
        'Taxable Value': purchase.taxableAmount,
        'CGST': purchase.cgstAmount,
        'SGST': purchase.sgstAmount,
        'IGST': purchase.igstAmount,
        'Total Amount': purchase.grandTotal,
      }));
      return sendCsv(res, csvRows, 'purchase-gst-register.csv');
    }

    return res.json({
      reportName: 'Purchase GST Register',
      summary,
      purchases,
    });
  } catch (err) {
    next(err);
  }
};

exports.purchaseGstItc = async (req, res, next) => {
  try {
    const purchases = await loadPurchaseGstRows(req.query);
    const summary = summarizePurchaseGstRows(purchases);
    const supplierSummary = buildSupplierSummary(purchases);
    const monthlySummary = buildMonthlySummary(purchases);
    const productSummary = buildProductSummary(purchases);

    return res.json({
      reportName: 'Input Tax Credit',
      summary,
      cards: {
        totalPurchaseValue: summary.totalPurchaseValue,
        totalGSTPaid: summary.totalGSTPaid,
        cgstCredit: summary.cgstCredit,
        sgstCredit: summary.sgstCredit,
        igstCredit: summary.igstCredit,
        totalITCAvailable: summary.totalITCAvailable,
      },
      gstBySupplier: supplierSummary,
      gstByMonth: monthlySummary,
      gstByProduct: productSummary,
      topGSTVendors: supplierSummary.slice(0, 5),
      highestGSTPaidSupplier: supplierSummary[0] || null,
    });
  } catch (err) {
    next(err);
  }
};

exports.purchaseGstAnalytics = async (req, res, next) => {
  try {
    const purchases = await loadPurchaseGstRows(req.query);
    const summary = summarizePurchaseGstRows(purchases);
    const supplierSummary = buildSupplierSummary(purchases);
    const monthlySummary = buildMonthlySummary(purchases);
    const productSummary = buildProductSummary(purchases);

    return res.json({
      reportName: 'Supplier GST Analytics',
      summary,
      topGSTVendors: supplierSummary.slice(0, 5),
      highestGSTPaidSupplier: supplierSummary[0] || null,
      supplierWiseSummary: supplierSummary,
      monthlyGSTTrend: monthlySummary,
      gstByProduct: productSummary,
      gstBySupplier: supplierSummary,
    });
  } catch (err) {
    next(err);
  }
};

exports.purchaseGstMonthlySummary = async (req, res, next) => {
  try {
    const purchases = await loadPurchaseGstRows(req.query);
    const summary = summarizePurchaseGstRows(purchases);
    const monthlySummary = buildMonthlySummary(purchases);

    return res.json({
      reportName: 'Monthly GST Summary',
      summary,
      months: monthlySummary,
    });
  } catch (err) {
    next(err);
  }
};

exports.purchaseGstReconciliation = async (req, res, next) => {
  try {
    const purchases = await loadPurchaseGstRows(req.query);
    const summary = summarizePurchaseGstRows(purchases);
    const reconciliation = buildReconciliationReport(purchases);

    return res.json({
      reportName: 'GST Reconciliation',
      summary,
      reconciliation,
      purchases: purchases.map((purchase) => ({
        purchaseNumber: purchase.purchaseNumber,
        supplier: purchase.supplier,
        invoiceNumber: purchase.invoiceNumber,
        invoiceDate: purchase.invoiceDate || purchase.date,
        supplierGstNumber: purchase.supplierGstNumber,
        gstTotal: purchase.gstTotal,
        taxableAmount: purchase.taxableAmount,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.dailyReport = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const sales = await Invoice.findAll({
      where: {
        date: {
          [Op.gte]: date,
          [Op.lt]: nextDay,
        },
      },
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'customerCode'] }],
    });
    const total = sales.reduce((sum, item) => sum + Number(item.grandTotal), 0);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Daily Report');
      ws.columns = [
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Total', key: 'grandTotal', width: 12 },
      ];
      sales.forEach((s) =>
        ws.addRow({
          invoiceNumber: s.invoiceNumber,
          customer: s.customer?.name,
          grandTotal: Number(s.grandTotal),
        })
      );
      return sendExcel(res, wb, `daily-report-${date.toISOString().split('T')[0]}.xlsx`);
    }

    res.json({ date, sales, count: sales.length, total });
  } catch (err) {
    next(err);
  }
};

exports.shippingReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt[Op.gte] = new Date(from);
      if (to) query.createdAt[Op.lte] = new Date(to);
    }
    const shipments = await Shipment.findAll({
      where: query,
      include: [
        {
          model: Invoice,
          as: 'invoice',
          include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone', 'email', 'customerCode'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const pending = shipments.filter(s => s.courierStatus === 'Pending').length;
    const inTransit = shipments.filter(s => ['In Transit', 'Out For Delivery'].includes(s.courierStatus)).length;
    const delivered = shipments.filter(s => s.courierStatus === 'Delivered').length;
    const returned = shipments.filter(s => s.courierStatus === 'Returned').length;

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Shipping Report');
      ws.columns = [
        { header: 'Shipment #', key: 'shipmentNumber', width: 15 },
        { header: 'Invoice #', key: 'invoiceNumber', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Courier', key: 'courier', width: 20 },
        { header: 'Tracking Number', key: 'trackingNumber', width: 20 },
        { header: 'Expected Delivery', key: 'expectedDeliveryDate', width: 15 },
        { header: 'Delivered Date', key: 'courierDeliveredDate', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Weight (kg)', key: 'packageWeight', width: 12 },
        { header: 'Count', key: 'packageCount', width: 10 },
      ];
      const formatVal = (val) => {
        if (!val) return 'N/A';
        try {
          const d = new Date(val);
          return isNaN(d.getTime()) ? 'N/A' : d.toISOString().split('T')[0];
        } catch (e) {
          return 'N/A';
        }
      };

      shipments.forEach((s) =>
        ws.addRow({
          shipmentNumber: s.shipmentNumber,
          invoiceNumber: s.invoice?.invoiceNumber || 'N/A',
          customer: s.invoice?.customer?.name || 'Walk-in',
          courier: s.courier,
          trackingNumber: s.trackingNumber,
          expectedDeliveryDate: formatVal(s.expectedDeliveryDate),
          courierDeliveredDate: formatVal(s.courierDeliveredDate),
          status: s.courierStatus,
          packageWeight: s.packageWeight ? Number(s.packageWeight) : 0,
          packageCount: s.packageCount || 1,
        })
      );
      return sendExcel(res, wb, 'shipping-report.xlsx');
    }

    res.json({
      shipments,
      count: shipments.length,
      metrics: {
        total: shipments.length,
        pending,
        inTransit,
        delivered,
        returned
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.shippingCostReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const query = {};
    if (from || to) {
      query.date = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        query.date[Op.gte] = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.date[Op.lte] = end;
      }
    }

    const invoices = await Invoice.findAll({
      where: query,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'customerCode'] }],
      order: [['date', 'DESC']],
    });

    const reportRows = invoices.map(inv => {
      const collected = Number(inv.shippingCharge || 0);
      const packing = Number(inv.packingCost || 0);
      const handling = Number(inv.handlingCost || 0);
      const courier = Number(inv.courierCost || 0);
      const loading = Number(inv.loadingCost || 0);
      const profitLoss = collected - (packing + handling + courier + loading);

      return {
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer?.name || 'Walk-in',
        customerCode: inv.customer?.customerCode || '',
        date: inv.date.toISOString().split('T')[0],
        shippingChargeCollected: collected,
        packingCost: packing,
        handlingCost: handling,
        courierCost: courier,
        loadingCost: loading,
        actualShippingProfitLoss: profitLoss,
      };
    });

    const totalCollected = reportRows.reduce((sum, r) => sum + r.shippingChargeCollected, 0);
    const totalPacking = reportRows.reduce((sum, r) => sum + r.packingCost, 0);
    const totalHandling = reportRows.reduce((sum, r) => sum + r.handlingCost, 0);
    const totalCourier = reportRows.reduce((sum, r) => sum + r.courierCost, 0);
    const totalLoading = reportRows.reduce((sum, r) => sum + r.loadingCost, 0);
    const totalProfitLoss = reportRows.reduce((sum, r) => sum + r.actualShippingProfitLoss, 0);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Shipping Cost Report');
      ws.columns = [
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Customer', key: 'customerName', width: 25 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Shipping Charge Collected (₹)', key: 'shippingChargeCollected', width: 28 },
        { header: 'Packing Cost (₹)', key: 'packingCost', width: 18 },
        { header: 'Handling Cost (₹)', key: 'handlingCost', width: 18 },
        { header: 'Courier Cost (₹)', key: 'courierCost', width: 18 },
        { header: 'Loading Cost (₹)', key: 'loadingCost', width: 18 },
        { header: 'Actual Shipping Profit/Loss (₹)', key: 'actualShippingProfitLoss', width: 30 },
      ];

      reportRows.forEach(r => ws.addRow(r));

      // Add summary row
      const summaryRow = ws.addRow({
        invoiceNumber: 'Total Summary',
        customerName: '',
        date: '',
        shippingChargeCollected: totalCollected,
        packingCost: totalPacking,
        handlingCost: totalHandling,
        courierCost: totalCourier,
        loadingCost: totalLoading,
        actualShippingProfitLoss: totalProfitLoss,
      });

      // Style summary row
      summaryRow.font = { bold: true };
      summaryRow.eachCell((cell, colNum) => {
        if (colNum >= 4) {
          cell.numFmt = '₹#,##0.00';
        }
      });

      return sendExcel(res, wb, 'shipping-cost-report.xlsx');
    }

    res.json({
      success: true,
      reportName: 'Shipping Cost Report',
      rows: reportRows,
      count: reportRows.length,
      metrics: {
        totalCollected,
        totalPacking,
        totalHandling,
        totalCourier,
        totalLoading,
        totalProfitLoss,
      }
    });
  } catch (err) {
    next(err);
  }
};

const fetchProcurementData = async () => {
  const RawMaterial = require('../models/RawMaterial');
  const StockMovement = require('../models/StockMovement');
  const RawMaterialMovement = require('../models/RawMaterialMovement');
  const Settings = require('../models/Settings');
  const Supplier = require('../models/Supplier');
  
  let settings = await Settings.findOne();
  let ignored = [];
  if (settings && settings.ignoredSuggestions) {
    try {
      ignored = JSON.parse(settings.ignoredSuggestions);
    } catch (e) {}
  }
  
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const items = [];

  // Products
  for (const p of lowProducts) {
    const key = `product:${p.id}`;
    const isIgnored = ignored.includes(key);

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
    const supplierName = p.preferredSupplier?.name || 'No Supplier Assigned';
    const status = Number(p.stock) <= 0 ? 'Critical' : 'Warning';

    items.push({
      key,
      itemId: p.id,
      itemType: 'product',
      code: p.sku || 'N/A',
      name: p.name,
      category: p.category || 'General',
      stock: Number(p.stock),
      minStock: Number(p.lowStockThreshold),
      reorderQty,
      unit: p.unit || 'pcs',
      purchasePrice,
      supplierName,
      estimatedValue,
      status,
      isIgnored,
      aiSuggestion: Number(p.stock) <= 0 
        ? `Stock is empty. Out of stock! Reorder immediately.`
        : `Purchase ${reorderQty} ${p.unit || 'pcs'} ${p.name}. Estimated stock will finish in ${daysLeft} days.`
    });
  }

  // Raw Materials
  for (const rm of lowRaw) {
    const key = `raw:${rm.id}`;
    const isIgnored = ignored.includes(key);

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
    const supplierName = rm.supplier?.name || 'No Supplier Assigned';
    const status = Number(rm.stock) <= 0 ? 'Critical' : 'Warning';

    items.push({
      key,
      itemId: rm.id,
      itemType: 'raw_material',
      code: rm.materialCode || 'N/A',
      name: rm.name,
      category: rm.category || 'General',
      stock: Number(rm.stock),
      minStock: Number(rm.minStock),
      reorderQty,
      unit: rm.unit || 'Kg',
      purchasePrice,
      supplierName,
      estimatedValue,
      status,
      isIgnored,
      aiSuggestion: Number(rm.stock) <= 0
        ? `Stock is empty. Out of stock! Reorder immediately.`
        : `Purchase ${reorderQty} ${rm.unit || 'Kg'} ${rm.name}. Estimated stock will finish in ${daysLeft} days.`
    });
  }

  return items;
};

exports.procurementReport = async (req, res, next) => {
  try {
    const { type } = req.params;
    const isExcel = req.query.export === 'excel';

    const allItems = await fetchProcurementData();

    if (type === 'low-stock') {
      const reportData = allItems.map(item => ({
        code: item.code,
        name: item.name,
        category: item.category,
        stock: item.stock,
        minStock: item.minStock,
        unit: item.unit,
        preferredSupplier: item.supplierName,
        status: item.status
      }));

      if (isExcel) {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Low Stock Report');
        ws.columns = [
          { header: 'Code', key: 'code', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Category', key: 'category', width: 18 },
          { header: 'Stock', key: 'stock', width: 12 },
          { header: 'Min Stock', key: 'minStock', width: 12 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Preferred Supplier', key: 'preferredSupplier', width: 25 },
          { header: 'Status', key: 'status', width: 12 }
        ];
        reportData.forEach(row => ws.addRow(row));
        return sendExcel(res, wb, 'low-stock-report.xlsx');
      }

      return res.json({ success: true, report: 'low-stock', data: reportData });
    }

    if (type === 'suggestions') {
      const filtered = allItems.filter(item => !item.isIgnored);
      const reportData = filtered.map(item => ({
        itemName: item.name,
        stock: item.stock,
        minStock: item.minStock,
        reorderQty: item.reorderQty,
        preferredSupplier: item.supplierName,
        value: item.estimatedValue,
        aiSuggestion: item.aiSuggestion
      }));

      if (isExcel) {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Purchase Suggestions');
        ws.columns = [
          { header: 'Item Name', key: 'itemName', width: 25 },
          { header: 'Stock', key: 'stock', width: 12 },
          { header: 'Min Stock', key: 'minStock', width: 12 },
          { header: 'Reorder Qty', key: 'reorderQty', width: 15 },
          { header: 'Preferred Supplier', key: 'preferredSupplier', width: 25 },
          { header: 'Value', key: 'value', width: 15 },
          { header: 'AI Suggestion', key: 'aiSuggestion', width: 45 }
        ];
        reportData.forEach(row => ws.addRow(row));
        return sendExcel(res, wb, 'purchase-suggestions-report.xlsx');
      }

      return res.json({ success: true, report: 'suggestions', data: reportData });
    }

    if (type === 'supplier-forecast') {
      const filtered = allItems.filter(item => !item.isIgnored);
      // Sort by preferred supplier name
      filtered.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

      const reportData = filtered.map(item => ({
        preferredSupplier: item.supplierName,
        itemName: item.name,
        stock: item.stock,
        minStock: item.minStock,
        reorderQty: item.reorderQty,
        unitCost: item.purchasePrice,
        forecastedCost: item.estimatedValue
      }));

      if (isExcel) {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Supplier Wise Forecast');
        ws.columns = [
          { header: 'Preferred Supplier', key: 'preferredSupplier', width: 25 },
          { header: 'Item Name', key: 'itemName', width: 25 },
          { header: 'Stock', key: 'stock', width: 12 },
          { header: 'Min Stock', key: 'minStock', width: 12 },
          { header: 'Reorder Qty', key: 'reorderQty', width: 15 },
          { header: 'Unit Cost', key: 'unitCost', width: 15 },
          { header: 'Forecasted Cost', key: 'forecastedCost', width: 18 }
        ];
        reportData.forEach(row => ws.addRow(row));
        return sendExcel(res, wb, 'supplier-wise-purchase-forecast.xlsx');
      }

      return res.json({ success: true, report: 'supplier-forecast', data: reportData });
    }

    if (type === 'procurement-plan') {
      const filtered = allItems.filter(item => !item.isIgnored);
      
      // Group by preferred supplier
      const supplierGroups = {};
      filtered.forEach(item => {
        const sup = item.supplierName;
        if (!supplierGroups[sup]) {
          supplierGroups[sup] = {
            supplierName: sup,
            itemsCount: 0,
            totalSpend: 0
          };
        }
        supplierGroups[sup].itemsCount += 1;
        supplierGroups[sup].totalSpend += item.estimatedValue;
      });

      const reportData = Object.values(supplierGroups).map(group => ({
        supplierName: group.supplierName,
        itemsCount: group.itemsCount,
        totalEstimatedSpend: group.totalSpend,
        leadTime: '7 Days',
        status: 'Pending PO'
      }));

      if (isExcel) {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Monthly Procurement Plan');
        ws.columns = [
          { header: 'Supplier Name', key: 'supplierName', width: 25 },
          { header: 'Items Count', key: 'itemsCount', width: 15 },
          { header: 'Total Estimated Spend', key: 'totalEstimatedSpend', width: 22 },
          { header: 'Lead Time', key: 'leadTime', width: 15 },
          { header: 'Status', key: 'status', width: 15 }
        ];
        reportData.forEach(row => ws.addRow(row));
        return sendExcel(res, wb, 'monthly-procurement-plan.xlsx');
      }

      return res.json({ success: true, report: 'procurement-plan', data: reportData });
    }

    return res.status(400).json({ success: false, message: 'Invalid report type' });
  } catch (err) {
    next(err);
  }
};

const loadSalesGstRows = async (filters = {}) => {
  const { from, to, month, quarter, financialYear, customerId, customer, gstNumber, state, hsn } = filters;
  
  const query = {
    is_historical_data: { [Op.ne]: true },
    [Op.or]: [
      { invoiceType: 'GST' },
      { customerGSTIN: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
      { '$customer.gstNumber$': { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
    ]
  };

  // Date filters
  if (from || to) {
    query.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      query.date[Op.gte] = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.date[Op.lte] = end;
    }
  }

  // Month filter (YYYY-MM format)
  if (month) {
    const year = parseInt(month.split('-')[0], 10);
    const monthIndex = parseInt(month.split('-')[1], 10) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    query.date = {
      [Op.gte]: start,
      [Op.lte]: end
    };
  }

  // Quarter filter
  if (quarter) {
    const currentYear = new Date().getFullYear();
    let qYear = currentYear;
    if (financialYear) {
      const parts = financialYear.split('-');
      qYear = parseInt(parts[0], 10);
    }
    let start, end;
    if (quarter === 'Q1') {
      start = new Date(qYear, 3, 1);
      end = new Date(qYear, 5, 30, 23, 59, 59, 999);
    } else if (quarter === 'Q2') {
      start = new Date(qYear, 6, 1);
      end = new Date(qYear, 8, 30, 23, 59, 59, 999);
    } else if (quarter === 'Q3') {
      start = new Date(qYear, 9, 1);
      end = new Date(qYear, 11, 31, 23, 59, 59, 999);
    } else if (quarter === 'Q4') {
      start = new Date(qYear + 1, 0, 1);
      end = new Date(qYear + 1, 2, 31, 23, 59, 59, 999);
    }
    if (start && end) {
      query.date = {
        [Op.gte]: start,
        [Op.lte]: end
      };
    }
  }

  // Financial Year filter
  if (financialYear && !quarter) {
    const parts = financialYear.split('-');
    const startYear = parseInt(parts[0], 10);
    const endYear = startYear + 1;
    const start = new Date(startYear, 3, 1);
    const end = new Date(endYear, 2, 31, 23, 59, 59, 999);
    query.date = {
      [Op.gte]: start,
      [Op.lte]: end
    };
  }

  // Customer filters
  if (customerId) {
    query.customerId = customerId;
  }

  // Place of supply / State filter
  if (state) {
    query.placeOfSupply = { [Op.like]: `%${state}%` };
  }

  // Customer GSTIN filter
  if (gstNumber) {
    query.customerGSTIN = { [Op.like]: `%${gstNumber}%` };
  }

  const include = [
    {
      model: Customer,
      as: 'customer',
      attributes: ['id', 'name', 'gstNumber', 'state', 'pincode', 'gstBillingMode', 'customerCode'],
      where: {}
    },
    {
      model: InvoiceItem,
      as: 'items',
      required: hsn ? true : false,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'sku', 'gstPercent', 'gstClass'],
          where: hsn ? { gstClass: hsn } : undefined,
          required: hsn ? true : false
        }
      ]
    }
  ];

  if (customer) {
    include[0].where.name = { [Op.like]: `%${customer}%` };
  }

  const invoices = await Invoice.findAll({
    where: query,
    include: include,
    order: [['date', 'DESC'], ['id', 'DESC']]
  });

  return invoices.map(inv => {
    const items = (inv.items || []).map(item => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.lineTotal || 0);
      const gstPercent = item.gstPercent !== undefined && item.gstPercent !== null ? Number(item.gstPercent) : Number(item.product?.gstPercent || 0);

      let taxableAmount = lineTotal;
      let taxAmount = 0;

      if (inv.gstBillingMode === 'inclusive') {
        taxableAmount = lineTotal / (1 + gstPercent / 100);
        taxAmount = lineTotal - taxableAmount;
      } else if (inv.gstBillingMode === 'exclusive') {
        taxableAmount = lineTotal;
        taxAmount = lineTotal * (gstPercent / 100);
      } else {
        taxableAmount = lineTotal;
        taxAmount = 0;
      }

      const custStateCode = inv.customer?.state ? getStateCodeByName(inv.customer.state) : '';
      const isInterState = custStateCode && custStateCode !== '33';
      
      const cgstAmount = isInterState ? 0 : taxAmount / 2;
      const sgstAmount = isInterState ? 0 : taxAmount / 2;
      const igstAmount = isInterState ? taxAmount : 0;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.name || item.product?.name || '',
        sku: item.product?.sku || '',
        gstClass: item.product?.gstClass || 'General',
        qty,
        unitPrice,
        gstPercent,
        taxableAmount: roundMoney(taxableAmount),
        taxAmount: roundMoney(taxAmount),
        cgstAmount: roundMoney(cgstAmount),
        sgstAmount: roundMoney(sgstAmount),
        igstAmount: roundMoney(igstAmount),
        lineTotal: roundMoney(lineTotal)
      };
    });

    const taxableAmount = items.reduce((sum, item) => sum + item.taxableAmount, 0);
    const cgstAmount = items.reduce((sum, item) => sum + item.cgstAmount, 0);
    const sgstAmount = items.reduce((sum, item) => sum + item.sgstAmount, 0);
    const igstAmount = items.reduce((sum, item) => sum + item.igstAmount, 0);
    const gstTotal = cgstAmount + sgstAmount + igstAmount;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerCode: inv.customer?.customerCode || '',
      customerName: inv.customer?.name || 'Walk-in Customer',
      customerGstNumber: inv.customerGSTIN || inv.customer?.gstNumber || '',
      customerState: inv.placeOfSupply || inv.customer?.state || '',
      gstBillingMode: inv.gstBillingMode || 'exclusive',
      paymentMethod: inv.paymentMethod,
      paymentStatus: inv.paymentStatus,
      shippingCharge: Number(inv.shippingCharge || 0),
      grandTotal: Number(inv.grandTotal || 0),
      date: inv.date,
      taxableAmount: roundMoney(Number(inv.taxableAmount) || Number(inv.taxableValue) || taxableAmount),
      cgstAmount: roundMoney(Number(inv.cgstAmount) || cgstAmount),
      sgstAmount: roundMoney(Number(inv.sgstAmount) || sgstAmount),
      igstAmount: roundMoney(Number(inv.igstAmount) || igstAmount),
      gstTotal: roundMoney(Number(inv.totalGST) || Number(inv.gstTotal) || gstTotal),
      items
    };
  }).filter(r => r.gstTotal > 0);
};

exports.salesGstr1Report = async (req, res, next) => {
  try {
    const rows = await loadSalesGstRows(req.query);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();

      // --- 1. B2B Sheet ---
      const wsB2b = wb.addWorksheet('B2B');
      wsB2b.columns = [
        { header: 'GSTIN/UIN of Recipient', key: 'gstin', width: 22 },
        { header: 'Receiver Name', key: 'receiverName', width: 25 },
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Invoice Date', key: 'date', width: 15 },
        { header: 'Invoice Value', key: 'value', width: 15 },
        { header: 'Place Of Supply', key: 'pos', width: 18 },
        { header: 'Reverse Charge', key: 'reverseCharge', width: 15 },
        { header: 'Invoice Type', key: 'invoiceType', width: 15 },
        { header: 'Rate (%)', key: 'rate', width: 12 },
        { header: 'Taxable Value', key: 'taxableValue', width: 15 },
        { header: 'CGST', key: 'cgst', width: 12 },
        { header: 'SGST', key: 'sgst', width: 12 },
        { header: 'IGST', key: 'igst', width: 12 }
      ];

      const b2bRows = [];
      rows.forEach(r => {
        if (r.customerGstNumber && r.customerGstNumber.trim() !== '') {
          const rateGroups = {};
          r.items.forEach(item => {
            const rate = item.gstPercent;
            if (!rateGroups[rate]) {
              rateGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
            }
            rateGroups[rate].taxable += item.taxableAmount;
            rateGroups[rate].cgst += item.cgstAmount;
            rateGroups[rate].sgst += item.sgstAmount;
            rateGroups[rate].igst += item.igstAmount;
          });
          
          Object.keys(rateGroups).forEach(rate => {
            b2bRows.push({
              gstin: r.customerGstNumber,
              receiverName: r.customerName,
              invoiceNumber: r.invoiceNumber,
              date: formatReportDate(r.date),
              value: r.grandTotal,
              pos: r.customerState,
              reverseCharge: 'N',
              invoiceType: 'Regular',
              rate: Number(rate),
              taxableValue: roundMoney(rateGroups[rate].taxable),
              cgst: roundMoney(rateGroups[rate].cgst),
              sgst: roundMoney(rateGroups[rate].sgst),
              igst: roundMoney(rateGroups[rate].igst)
            });
          });
        }
      });
      b2bRows.forEach(row => wsB2b.addRow(row));

      // --- 2. B2CL Sheet ---
      const wsB2cl = wb.addWorksheet('B2CL');
      wsB2cl.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Invoice Date', key: 'date', width: 15 },
        { header: 'Invoice Value', key: 'value', width: 15 },
        { header: 'Place Of Supply', key: 'pos', width: 18 },
        { header: 'Rate (%)', key: 'rate', width: 12 },
        { header: 'Taxable Value', key: 'taxableValue', width: 15 },
        { header: 'IGST Amount', key: 'igst', width: 15 }
      ];

      const b2clRows = [];
      rows.forEach(r => {
        const isUnregistered = (!r.customerGstNumber || r.customerGstNumber.trim() === '');
        const custStateCode = r.customerState ? getStateCodeByName(r.customerState) : '';
        const isInterState = custStateCode && custStateCode !== '33';
        const isLarge = r.grandTotal > 250000;
        
        if (isUnregistered && isInterState && isLarge) {
          const rateGroups = {};
          r.items.forEach(item => {
            const rate = item.gstPercent;
            if (!rateGroups[rate]) {
              rateGroups[rate] = { taxable: 0, igst: 0 };
            }
            rateGroups[rate].taxable += item.taxableAmount;
            rateGroups[rate].igst += item.igstAmount;
          });
          
          Object.keys(rateGroups).forEach(rate => {
            b2clRows.push({
              invoiceNumber: r.invoiceNumber,
              date: formatReportDate(r.date),
              value: r.grandTotal,
              pos: r.customerState,
              rate: Number(rate),
              taxableValue: roundMoney(rateGroups[rate].taxable),
              igst: roundMoney(rateGroups[rate].igst)
            });
          });
        }
      });
      b2clRows.forEach(row => wsB2cl.addRow(row));

      // --- 3. B2CS Sheet ---
      const wsB2cs = wb.addWorksheet('B2CS');
      wsB2cs.columns = [
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Place Of Supply', key: 'pos', width: 18 },
        { header: 'Rate (%)', key: 'rate', width: 12 },
        { header: 'Taxable Value', key: 'taxableValue', width: 15 },
        { header: 'CGST', key: 'cgst', width: 12 },
        { header: 'SGST', key: 'sgst', width: 12 },
        { header: 'IGST', key: 'igst', width: 12 }
      ];

      const b2csMap = {};
      rows.forEach(r => {
        const isUnregistered = (!r.customerGstNumber || r.customerGstNumber.trim() === '');
        const custStateCode = r.customerState ? getStateCodeByName(r.customerState) : '';
        const isInterState = custStateCode && custStateCode !== '33';
        const isLarge = r.grandTotal > 250000;
        
        if (isUnregistered && (!isInterState || !isLarge)) {
          const pos = r.customerState || 'Tamil Nadu';
          r.items.forEach(item => {
            const rate = item.gstPercent;
            const key = `${pos}::${rate}`;
            if (!b2csMap[key]) {
              b2csMap[key] = {
                type: 'OE',
                pos,
                rate: Number(rate),
                taxableValue: 0,
                cgst: 0,
                sgst: 0,
                igst: 0
              };
            }
            b2csMap[key].taxableValue += item.taxableAmount;
            b2csMap[key].cgst += item.cgstAmount;
            b2csMap[key].sgst += item.sgstAmount;
            b2csMap[key].igst += item.igstAmount;
          });
        }
      });
      const b2csRows = Object.values(b2csMap).map(row => {
        row.taxableValue = roundMoney(row.taxableValue);
        row.cgst = roundMoney(row.cgst);
        row.sgst = roundMoney(row.sgst);
        row.igst = roundMoney(row.igst);
        return row;
      });
      b2csRows.forEach(row => wsB2cs.addRow(row));

      // --- 4. HSN Sheet ---
      const wsHsn = wb.addWorksheet('HSN');
      wsHsn.columns = [
        { header: 'HSN', key: 'hsn', width: 15 },
        { header: 'Description', key: 'description', width: 25 },
        { header: 'UQC', key: 'uqc', width: 12 },
        { header: 'Total Quantity', key: 'qty', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
        { header: 'Taxable Value', key: 'taxableValue', width: 15 },
        { header: 'CGST', key: 'cgst', width: 12 },
        { header: 'SGST', key: 'sgst', width: 12 },
        { header: 'IGST', key: 'igst', width: 12 },
        { header: 'Total GST', key: 'totalGst', width: 15 }
      ];

      const hsnMap = {};
      rows.forEach(r => {
        r.items.forEach(item => {
          const hsn = item.gstClass || '0000';
          const rate = item.gstPercent;
          const key = `${hsn}::${rate}`;
          if (!hsnMap[key]) {
            hsnMap[key] = {
              hsn,
              description: `GST Class ${hsn}`,
              uqc: 'UQC',
              qty: 0,
              totalValue: 0,
              taxableValue: 0,
              cgst: 0,
              sgst: 0,
              igst: 0,
              totalGst: 0
            };
          }
          hsnMap[key].qty += item.qty;
          hsnMap[key].taxableValue += item.taxableAmount;
          hsnMap[key].cgst += item.cgstAmount;
          hsnMap[key].sgst += item.sgstAmount;
          hsnMap[key].igst += item.igstAmount;
          hsnMap[key].totalGst += item.taxAmount;
          hsnMap[key].totalValue += item.lineTotal;
        });
      });
      const hsnRows = Object.values(hsnMap).map(row => {
        row.qty = roundMoney(row.qty);
        row.totalValue = roundMoney(row.totalValue);
        row.taxableValue = roundMoney(row.taxableValue);
        row.cgst = roundMoney(row.cgst);
        row.sgst = roundMoney(row.sgst);
        row.igst = roundMoney(row.igst);
        row.totalGst = roundMoney(row.totalGst);
        return row;
      });
      hsnRows.forEach(row => wsHsn.addRow(row));

      // --- 5. Documents Sheet ---
      const wsDocs = wb.addWorksheet('Documents');
      wsDocs.columns = [
        { header: 'Nature of Document', key: 'docType', width: 28 },
        { header: 'Sr. No. From', key: 'from', width: 18 },
        { header: 'Sr. No. To', key: 'to', width: 18 },
        { header: 'Total Number', key: 'total', width: 15 },
        { header: 'Cancelled', key: 'cancelled', width: 12 },
        { header: 'Net Issued', key: 'net', width: 15 }
      ];

      let minInvoiceNum = '';
      let maxInvoiceNum = '';
      let totalCount = rows.length;
      
      if (rows.length > 0) {
        const sortedInvoices = [...rows].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
        minInvoiceNum = sortedInvoices[0].invoiceNumber;
        maxInvoiceNum = sortedInvoices[sortedInvoices.length - 1].invoiceNumber;
      }
      const docsRows = [{
        docType: 'Invoices for outward supply',
        from: minInvoiceNum,
        to: maxInvoiceNum,
        total: totalCount,
        cancelled: 0,
        net: totalCount
      }];
      docsRows.forEach(row => wsDocs.addRow(row));

      // --- 6. Summary Sheet ---
      const wsSummary = wb.addWorksheet('Summary');
      wsSummary.columns = [
        { header: 'Section / Sheet Name', key: 'section', width: 25 },
        { header: 'Total Taxable Value', key: 'taxable', width: 20 },
        { header: 'Total CGST', key: 'cgst', width: 15 },
        { header: 'Total SGST', key: 'sgst', width: 15 },
        { header: 'Total IGST', key: 'igst', width: 15 }
      ];

      const summaryRows = [
        { section: 'B2B Total', taxable: b2bRows.reduce((s, r) => s + r.taxableValue, 0), cgst: b2bRows.reduce((s, r) => s + r.cgst, 0), sgst: b2bRows.reduce((s, r) => s + r.sgst, 0), igst: b2bRows.reduce((s, r) => s + r.igst, 0) },
        { section: 'B2CL Total', taxable: b2clRows.reduce((s, r) => s + r.taxableValue, 0), cgst: 0, sgst: 0, igst: b2clRows.reduce((s, r) => s + r.igst, 0) },
        { section: 'B2CS Total', taxable: b2csRows.reduce((s, r) => s + r.taxableValue, 0), cgst: b2csRows.reduce((s, r) => s + r.cgst, 0), sgst: b2csRows.reduce((s, r) => s + r.sgst, 0), igst: b2csRows.reduce((s, r) => s + r.igst, 0) },
        { section: 'HSN Total', taxable: hsnRows.reduce((s, r) => s + r.taxableValue, 0), cgst: hsnRows.reduce((s, r) => s + r.cgst, 0), sgst: hsnRows.reduce((s, r) => s + r.sgst, 0), igst: hsnRows.reduce((s, r) => s + r.igst, 0) }
      ];
      summaryRows.forEach(row => {
        row.taxable = roundMoney(row.taxable);
        row.cgst = roundMoney(row.cgst);
        row.sgst = roundMoney(row.sgst);
        row.igst = roundMoney(row.igst);
        wsSummary.addRow(row);
      });

      return sendExcel(res, wb, 'gstr-1-portal-report.xlsx');
    }

    if (req.query.export === 'csv') {
      const csvRows = rows.map(r => ({
        'Invoice Number': r.invoiceNumber,
        'Date': formatReportDate(r.date),
        'Customer Name': r.customerName,
        'GSTIN': r.customerGstNumber,
        'Taxable Value': r.taxableAmount,
        'CGST': r.cgstAmount,
        'SGST': r.sgstAmount,
        'IGST': r.igstAmount,
        'GST Total': r.gstTotal,
        'Invoice Value': r.grandTotal,
        'Billing State': r.customerState
      }));
      return sendCsv(res, csvRows, 'gstr-1-report.csv');
    }

    res.json({ success: true, report: 'GSTR-1', data: rows });
  } catch (err) {
    next(err);
  }
};

exports.salesGstB2bReport = async (req, res, next) => {
  try {
    const allRows = await loadSalesGstRows(req.query);
    const rows = allRows.filter(r => r.customerGstNumber && r.customerGstNumber.trim() !== '');

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('B2B Report');
      ws.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'GSTIN', key: 'customerGstNumber', width: 20 },
        { header: 'Taxable Value', key: 'taxableAmount', width: 15 },
        { header: 'CGST', key: 'cgstAmount', width: 12 },
        { header: 'SGST', key: 'sgstAmount', width: 12 },
        { header: 'IGST', key: 'igstAmount', width: 12 },
        { header: 'Invoice Value', key: 'grandTotal', width: 15 }
      ];

      rows.forEach(r => ws.addRow({
        invoiceNumber: r.invoiceNumber,
        date: formatReportDate(r.date),
        customerName: r.customerName,
        customerGstNumber: r.customerGstNumber,
        taxableAmount: r.taxableAmount,
        cgstAmount: r.cgstAmount,
        sgstAmount: r.sgstAmount,
        igstAmount: r.igstAmount,
        grandTotal: r.grandTotal
      }));

      return sendExcel(res, wb, 'b2b-gst-report.xlsx');
    }

    res.json({ success: true, report: 'B2B', data: rows });
  } catch (err) {
    next(err);
  }
};

exports.salesGstB2cReport = async (req, res, next) => {
  try {
    const allRows = await loadSalesGstRows(req.query);
    const rows = allRows.filter(r => !r.customerGstNumber || r.customerGstNumber.trim() === '');

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('B2C Report');
      ws.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Taxable Value', key: 'taxableAmount', width: 15 },
        { header: 'CGST', key: 'cgstAmount', width: 12 },
        { header: 'SGST', key: 'sgstAmount', width: 12 },
        { header: 'IGST', key: 'igstAmount', width: 12 },
        { header: 'Invoice Value', key: 'grandTotal', width: 15 }
      ];

      rows.forEach(r => ws.addRow({
        invoiceNumber: r.invoiceNumber,
        date: formatReportDate(r.date),
        customerName: r.customerName,
        taxableAmount: r.taxableAmount,
        cgstAmount: r.cgstAmount,
        sgstAmount: r.sgstAmount,
        igstAmount: r.igstAmount,
        grandTotal: r.grandTotal
      }));

      return sendExcel(res, wb, 'b2c-gst-report.xlsx');
    }

    res.json({ success: true, report: 'B2C', data: rows });
  } catch (err) {
    next(err);
  }
};

exports.salesGstHsnReport = async (req, res, next) => {
  try {
    const rows = await loadSalesGstRows(req.query);
    const hsnMap = new Map();

    rows.forEach(r => {
      r.items.forEach(item => {
        const key = `${item.gstClass}::${item.gstPercent}`;
        const existing = hsnMap.get(key) || {
          gstClass: item.gstClass,
          description: `GST Class: ${item.gstClass} @ ${item.gstPercent}%`,
          gstPercent: item.gstPercent,
          qty: 0,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          taxAmount: 0
        };

        existing.qty += item.qty;
        existing.taxableAmount = roundMoney(existing.taxableAmount + item.taxableAmount);
        existing.cgstAmount = roundMoney(existing.cgstAmount + item.cgstAmount);
        existing.sgstAmount = roundMoney(existing.sgstAmount + item.sgstAmount);
        existing.igstAmount = roundMoney(existing.igstAmount + item.igstAmount);
        existing.taxAmount = roundMoney(existing.taxAmount + item.taxAmount);

        hsnMap.set(key, existing);
      });
    });

    const data = [...hsnMap.values()];

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('HSN Summary');
      ws.columns = [
        { header: 'HSN / GST Class', key: 'gstClass', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'GST %', key: 'gstPercent', width: 10 },
        { header: 'Total Qty', key: 'qty', width: 12 },
        { header: 'Taxable Value', key: 'taxableAmount', width: 15 },
        { header: 'CGST', key: 'cgstAmount', width: 12 },
        { header: 'SGST', key: 'sgstAmount', width: 12 },
        { header: 'IGST', key: 'igstAmount', width: 12 },
        { header: 'Total Tax', key: 'taxAmount', width: 15 }
      ];

      data.forEach(d => ws.addRow(d));
      return sendExcel(res, wb, 'hsn-summary-report.xlsx');
    }

    res.json({ success: true, report: 'HSN Summary', data });
  } catch (err) {
    next(err);
  }
};

exports.salesGstRegister = async (req, res, next) => {
  try {
    const rows = await loadSalesGstRows(req.query);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sales GST Register');
      ws.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'GSTIN', key: 'customerGstNumber', width: 20 },
        { header: 'Taxable Value', key: 'taxableAmount', width: 15 },
        { header: 'CGST', key: 'cgstAmount', width: 12 },
        { header: 'SGST', key: 'sgstAmount', width: 12 },
        { header: 'IGST', key: 'igstAmount', width: 12 },
        { header: 'Total GST', key: 'gstTotal', width: 15 },
        { header: 'Shipping', key: 'shippingCharge', width: 12 },
        { header: 'Total Value', key: 'grandTotal', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Status', key: 'paymentStatus', width: 12 }
      ];

      rows.forEach(r => ws.addRow(r));
      return sendExcel(res, wb, 'sales-gst-register.xlsx');
    }

    res.json({ success: true, report: 'Sales Register', data: rows });
  } catch (err) {
    next(err);
  }
};

exports.salesGstSummaryReport = async (req, res, next) => {
  try {
    const sales = await loadSalesGstRows(req.query);
    const purchases = await loadPurchaseGstRows(req.query);

    const cgstLiability = sales.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
    const sgstLiability = sales.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
    const igstLiability = sales.reduce((sum, item) => sum + (item.igstAmount || 0), 0);
    const totalLiability = cgstLiability + sgstLiability + igstLiability;

    const cgstItc = purchases.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
    const sgstItc = purchases.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
    const igstItc = purchases.reduce((sum, item) => sum + (item.igstAmount || 0), 0);
    const totalItc = cgstItc + sgstItc + igstItc;

    const netCgstPayable = cgstLiability - cgstItc;
    const netSgstPayable = sgstLiability - sgstItc;
    const netIgstPayable = igstLiability - igstItc;
    const netGstPayable = totalLiability - totalItc;

    res.json({
      success: true,
      report: 'GST Summary',
      data: {
        cgstLiability: roundMoney(cgstLiability),
        sgstLiability: roundMoney(sgstLiability),
        igstLiability: roundMoney(igstLiability),
        totalLiability: roundMoney(totalLiability),
        cgstItc: roundMoney(cgstItc),
        sgstItc: roundMoney(sgstItc),
        igstItc: roundMoney(igstItc),
        totalItc: roundMoney(totalItc),
        netCgstPayable: roundMoney(netCgstPayable),
        netSgstPayable: roundMoney(netSgstPayable),
        netIgstPayable: roundMoney(netIgstPayable),
        netGstPayable: roundMoney(netGstPayable),
        salesCount: sales.length,
        purchasesCount: purchases.length
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getBulkStockReport = async (req, res, next) => {
  try {
    const Product = require('../models/Product');
    const products = await Product.findAll({
      where: { productType: 'BULK_PRODUCT', isArchived: false }
    });
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

exports.getPackingConversionReport = async (req, res, next) => {
  try {
    const PackingConversion = require('../models/PackingConversion');
    const PackingConversionItem = require('../models/PackingConversionItem');
    const Product = require('../models/Product');
    const User = require('../models/User');

    const conversions = await PackingConversion.findAll({
      include: [
        { model: Product, as: 'sourceProduct', attributes: ['name', 'sku', 'unit'] },
        { model: User, as: 'createdBy', attributes: ['name'] },
        {
          model: PackingConversionItem,
          as: 'items',
          include: [{ model: Product, as: 'targetProduct', attributes: ['name', 'sku', 'unit'] }]
        }
      ],
      order: [['date', 'DESC']]
    });
    res.json({ success: true, data: conversions });
  } catch (err) {
    next(err);
  }
};

exports.getVariantStockReport = async (req, res, next) => {
  try {
    const Product = require('../models/Product');
    const { Op } = require('sequelize');
    const products = await Product.findAll({
      where: {
        productType: { [Op.in]: ['RETAIL_PACK', 'LABEL_PACK'] },
        isArchived: false
      },
      include: [{ model: Product, as: 'parentProduct', attributes: ['name', 'sku'] }]
    });
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

exports.getManufacturingYieldReport = async (req, res, next) => {
  try {
    const ManufacturingEntry = require('../models/ManufacturingEntry');
    const ManufacturingRecipe = require('../models/ManufacturingRecipe');
    const Product = require('../models/Product');
    const User = require('../models/User');

    const entries = await ManufacturingEntry.findAll({
      where: { status: 'completed' },
      include: [
        { model: Product, as: 'product', attributes: ['name', 'sku', 'unit', 'purchasePrice'] },
        { model: ManufacturingRecipe, as: 'recipe', attributes: ['name', 'yieldQty'] },
        { model: User, as: 'createdBy', attributes: ['name'] }
      ],
      order: [['date', 'DESC']]
    });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};
