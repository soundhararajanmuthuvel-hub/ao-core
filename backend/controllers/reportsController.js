const ExcelJS = require('exceljs');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');

const sendExcel = async (res, workbook, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.salesReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    const sales = await Invoice.find(query).populate('customer', 'name').sort({ date: -1 });

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
          grandTotal: s.grandTotal,
          paymentStatus: s.paymentStatus,
        })
      );
      return sendExcel(res, wb, 'sales-report.xlsx');
    }

    res.json({ sales, count: sales.length, total: sales.reduce((s, i) => s + i.grandTotal, 0) });
  } catch (err) {
    next(err);
  }
};

exports.purchasesReport = async (req, res, next) => {
  try {
    const purchases = await Purchase.find().sort({ date: -1 });
    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Purchases Report');
      ws.columns = [
        { header: 'PO #', key: 'purchaseNumber', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Total', key: 'total', width: 12 },
      ];
      purchases.forEach((p) =>
        ws.addRow({
          purchaseNumber: p.purchaseNumber,
          supplier: p.supplier,
          date: p.date.toISOString().split('T')[0],
          total: p.total,
        })
      );
      return sendExcel(res, wb, 'purchases-report.xlsx');
    }
    res.json({ purchases, count: purchases.length, total: purchases.reduce((s, p) => s + p.total, 0) });
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

    const sales = await Invoice.find({ date: { $gte: date, $lt: nextDay } }).populate('customer', 'name');
    const total = sales.reduce((s, i) => s + i.grandTotal, 0);

    if (req.query.export === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Daily Report');
      ws.columns = [
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Total', key: 'grandTotal', width: 12 },
      ];
      sales.forEach((s) =>
        ws.addRow({ invoiceNumber: s.invoiceNumber, customer: s.customer?.name, grandTotal: s.grandTotal })
      );
      return sendExcel(res, wb, `daily-report-${date.toISOString().split('T')[0]}.xlsx`);
    }

    res.json({ date, sales, count: sales.length, total });
  } catch (err) {
    next(err);
  }
};
