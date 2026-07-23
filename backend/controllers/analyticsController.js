const { Op, col } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const PackingConversion = require('../models/PackingConversion');
const PackingConversionItem = require('../models/PackingConversionItem');
const WebsiteOrder = require('../models/WebsiteOrder');

const dashboardCache = {
  data: null,
  timestamp: 0,
  ttl: 45000 // 45 seconds TTL
};

const getDashboardDataInternal = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isMySQL = sequelize.options.dialect === 'mysql';

  // Calculate start/end of current month for Monthly Revenue KPI card
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Run basic card count promises
  const delayThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const [
    productCount,
    salesStatsResult,
    todayStatsResult,
    lowStockCount,
    delayedOrdersCount,
    currentMonthlyRevenueResult,
    pendingDispatchCount,
    bulkProductsForValuation,
    retailPackStockSum,
    packingDoneTodayResult,
    mfgDoneTodayResult,
    packingConversionsToday,
    websiteOrdersTodayCount,
    websiteRevenueTodayResult,
    pendingWebsiteOrdersCount
  ] = await Promise.all([
    Product.count({ where: { isArchived: false } }),
    sequelize.query(
      `SELECT 
         COUNT(DISTINCT i.id) AS totalSales,
         COALESCE(SUM(i.grandTotal), 0) AS revenue,
         COALESCE(SUM((ii.qty * ii.unitPrice) - ((ii.qty + COALESCE(ii.freeQty, 0)) * COALESCE(ii.purchasePrice, 0))), 0) AS profit
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoiceId`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT 
         COALESCE(SUM(grandTotal), 0) AS todaySales,
         COUNT(id) AS todayOrders
       FROM invoices
       WHERE date >= :today AND date < :tomorrow AND type = 'invoice' AND status NOT IN ('Draft', 'Cancelled')`,
      {
        replacements: { today, tomorrow },
        type: sequelize.QueryTypes.SELECT,
      }
    ),
    Product.count({
      where: {
        isArchived: false,
        stock: { [Op.lte]: col('lowStockThreshold') }
      }
    }),
    Order.count({
      where: {
        status: 'Prepared',
        orderDate: { [Op.lte]: delayThreshold }
      }
    }),
    Invoice.sum('grandTotal', {
      where: {
        type: 'invoice',
        status: { [Op.notIn]: ['Draft', 'Cancelled'] },
        date: { [Op.between]: [currentMonthStart, currentMonthEnd] }
      }
    }),
    Order.count({
      where: {
        status: { [Op.in]: ['Prepared', 'Packed'] }
      }
    }),
    Product.findAll({
      where: { productType: 'BULK_PRODUCT', isArchived: false },
      attributes: ['id', 'name', 'stock', 'unit', 'purchasePrice'],
      raw: true
    }),
    Product.sum('stock', {
      where: {
        productType: { [Op.in]: ['RETAIL_PACK', 'LABEL_PACK'] },
        isArchived: false
      }
    }),
    sequelize.query(
      `SELECT COALESCE(SUM(pci.qty), 0) AS total
       FROM packing_conversions pc
       JOIN packing_conversion_items pci ON pc.id = pci.packingConversionId
       WHERE pc.date >= :today AND pc.date < :tomorrow AND pc.status = 'completed'`,
      {
        replacements: { today, tomorrow },
        type: sequelize.QueryTypes.SELECT,
      }
    ),
    sequelize.query(
      `SELECT COALESCE(SUM(qtyToProduce), 0) AS total
       FROM manufacturing_entries
       WHERE date >= :today AND date < :tomorrow AND status = 'completed'`,
      {
        replacements: { today, tomorrow },
        type: sequelize.QueryTypes.SELECT,
      }
    ),
    PackingConversion.findAll({
      where: {
        date: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
        status: 'completed',
      },
      include: [
        {
          model: PackingConversionItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'targetProduct',
              attributes: ['id', 'name', 'packSize', 'unit'],
            },
          ],
        },
      ],
    }),
    WebsiteOrder.count({
      where: {
        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow }
      }
    }),
    WebsiteOrder.sum('totalAmount', {
      where: {
        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow },
        paymentStatus: 'Captured'
      }
    }),
    WebsiteOrder.count({
      where: { status: 'Pending' }
    })
  ]);

  // Calculate bulk stock value
  let bulkStockValue = 0;
  if (bulkProductsForValuation && bulkProductsForValuation.length) {
    bulkProductsForValuation.forEach(p => {
      bulkStockValue += Number(p.stock || 0) * Number(p.purchasePrice || 0);
    });
  }

  const retailPackStock = Number(retailPackStockSum || 0);
  const packingDoneToday = Number(packingDoneTodayResult?.[0]?.total || 0);
  const mfgDoneToday = Number(mfgDoneTodayResult?.[0]?.total || 0);

  const stats = salesStatsResult[0] || { totalSales: 0, revenue: 0, profit: 0 };
  const todayData = todayStatsResult[0] || { todaySales: 0, todayOrders: 0 };

  // Fetch all active outstanding invoices for period filter processing
  const unpaidInvoices = await Invoice.findAll({
    where: {
      type: 'invoice',
      paymentStatus: { [Op.notIn]: ['paid', 'PAID'] },
      status: { [Op.notIn]: ['Draft', 'Cancelled'] }
    },
    include: [{
      model: Customer,
      as: 'customer',
      attributes: ['id', 'name', 'phone']
    }]
  });

  // Compute outstanding metrics for periods (Today, This Month, This Quarter, Financial Year, All Time)
  const calculateFilterMetrics = (invoices, filterFn) => {
    const filtered = invoices.filter(inv => filterFn(new Date(inv.date)));
    let totalOutstanding = 0;
    let totalOverdue = 0;
    const unpaidCount = filtered.length;

    const customerMap = {};

    for (const inv of filtered) {
      const amt = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      if (amt <= 0) continue;

      totalOutstanding += amt;

      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
      due.setHours(0,0,0,0);
      const todayForDue = new Date();
      todayForDue.setHours(0,0,0,0);
      if (todayForDue > due) {
        totalOverdue += amt;
      }

      const custId = inv.customerId || 'walk-in';
      const name = inv.customer?.name || 'Walk-in';
      const phone = inv.customer?.phone || '';

      if (!customerMap[custId]) {
        customerMap[custId] = { name, phone, amount: 0 };
      }
      customerMap[custId].amount += amt;
    }

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalOutstanding,
      totalOverdue,
      unpaidCount,
      topCustomers
    };
  };

  const todayStart = new Date(today);
  const outstandingMetrics = {
    today: calculateFilterMetrics(unpaidInvoices, (d) => d >= todayStart),
    this_month: calculateFilterMetrics(unpaidInvoices, (d) => d >= currentMonthStart),
    this_quarter: calculateFilterMetrics(unpaidInvoices, (d) => {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return d >= qStart;
    }),
    financial_year: calculateFilterMetrics(unpaidInvoices, (d) => {
      const currentYear = now.getFullYear();
      const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
      return d >= fyStart;
    }),
    all_time: calculateFilterMetrics(unpaidInvoices, () => true)
  };

  // Outstanding Trend over 6 months
  const getTrendData = (invoices) => {
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      const filtered = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getFullYear() === year && invDate.getMonth() === month;
      });

      const amount = filtered.reduce((sum, inv) => sum + (Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0)), 0);
      trend.push({
        name: label,
        amount: Math.round(amount)
      });
    }
    return trend;
  };

  const outstandingTrend = getTrendData(unpaidInvoices);

  // Monthly revenue and profit trend (conditional on dialect)
  const monthlyQuery = isMySQL
    ? `SELECT 
         YEAR(i.date) AS year,
         MONTH(i.date) AS month,
         COALESCE(SUM(i.grandTotal), 0) AS revenue,
         COUNT(DISTINCT i.id) AS orders,
         COALESCE(SUM((ii.qty * ii.unitPrice) - ((ii.qty + COALESCE(ii.freeQty, 0)) * COALESCE(ii.purchasePrice, 0))), 0) AS profit
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoiceId
       GROUP BY YEAR(i.date), MONTH(i.date)
       ORDER BY year ASC, month ASC
       LIMIT 12`
    : `SELECT 
         strftime('%Y', i.date) AS year,
         strftime('%m', i.date) AS month,
         COALESCE(SUM(i.grandTotal), 0) AS revenue,
         COUNT(DISTINCT i.id) AS orders,
         COALESCE(SUM((ii.qty * ii.unitPrice) - ((ii.qty + COALESCE(ii.freeQty, 0)) * COALESCE(ii.purchasePrice, 0))), 0) AS profit
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoiceId
       GROUP BY strftime('%Y', i.date), strftime('%m', i.date)
       ORDER BY year ASC, month ASC
       LIMIT 12`;

  const monthlyRevenue = await sequelize.query(monthlyQuery, { type: sequelize.QueryTypes.SELECT });

  // Top 5 selling products
  const topProducts = await sequelize.query(
    `SELECT 
       ii.productId AS productId,
       ii.name,
       SUM(ii.qty) AS totalQty,
       SUM(ii.lineTotal) AS revenue
     FROM invoice_items ii
     GROUP BY ii.productId, ii.name
     ORDER BY totalQty DESC
     LIMIT 5`,
    { type: sequelize.QueryTypes.SELECT }
  );

  // 30-day sales trend (conditional on dialect)
  const trendQuery = isMySQL
    ? `SELECT 
         DATE_FORMAT(date, '%Y-%m-%d') AS date,
         COALESCE(SUM(grandTotal), 0) AS total,
         COUNT(id) AS count
       FROM invoices
       GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
       ORDER BY date ASC
       LIMIT 30`
    : `SELECT 
         strftime('%Y-%m-%d', date) AS date,
         COALESCE(SUM(grandTotal), 0) AS total,
         COUNT(id) AS count
       FROM invoices
       GROUP BY strftime('%Y-%m-%d', date)
       ORDER BY date ASC
       LIMIT 30`;

  const salesTrend = await sequelize.query(trendQuery, { type: sequelize.QueryTypes.SELECT });

  const packedTodayMap = {};
  for (const pc of packingConversionsToday) {
    if (pc.items) {
      for (const item of pc.items) {
        const target = item.targetProduct;
        if (target) {
          const key = target.packSize || target.name;
          const qty = Number(item.qty || 0);
          if (!packedTodayMap[key]) {
            packedTodayMap[key] = {
              name: target.name,
              packSize: target.packSize || '',
              qty: 0,
              unit: target.unit || 'PCS'
            };
          }
          packedTodayMap[key].qty += qty;
        }
      }
    }
  }
  const packedTodayList = Object.values(packedTodayMap);

  const { getTargetDashboardDataInternal } = require('./salesTargetController');
  let targets = null;
  try {
    targets = await getTargetDashboardDataInternal();
  } catch (e) {
    console.error('Failed to load targets on main dashboard:', e);
  }

  return {
    cards: {
      totalProducts: productCount,
      totalSales: Number(stats.totalSales),
      revenue: Number(stats.revenue),
      profit: Number(stats.profit),
      todaySales: Number(todayData.todaySales),
      todayOrders: Number(todayData.todayOrders),
      lowStockCount,
      delayedOrdersCount,
      monthlyRevenue: Number(currentMonthlyRevenueResult || 0),
      pendingDispatchOrders: Number(pendingDispatchCount || 0),
      bulkStockValue,
      retailPackStock,
      packingDoneToday,
      mfgDoneToday,
      websiteOrdersToday: Number(websiteOrdersTodayCount || 0),
      websiteRevenueToday: Number(websiteRevenueTodayResult || 0),
      pendingWebsiteOrders: Number(pendingWebsiteOrdersCount || 0)
    },
    charts: {
      monthlyRevenue: monthlyRevenue.map((m) => ({
        label: `${m.year}-${String(m.month).padStart(2, '0')}`,
        revenue: Number(m.revenue),
        profit: Number(m.profit),
        orders: Number(m.orders),
      })),
      topProducts: topProducts.map((p) => ({
        name: p.name || 'Unknown',
        qty: Number(p.totalQty),
        revenue: Number(p.revenue),
      })),
      salesTrend: salesTrend.map((s) => ({ date: s.date, total: Number(s.total), count: Number(s.count) })),
    },
    outstanding: outstandingMetrics,
    outstandingTrend,
    bulkProductsList: bulkProductsForValuation,
    packedTodayList,
    targets
  };
};

exports.getDashboardDataInternal = getDashboardDataInternal;

exports.getDashboard = async (req, res, next) => {
  try {
    const nowTime = Date.now();
    if (dashboardCache.data && (nowTime - dashboardCache.timestamp < dashboardCache.ttl)) {
      return res.json(dashboardCache.data);
    }

    const { reconcileInvoicesHelper } = require('./salesController');
    await reconcileInvoicesHelper();

    const data = await getDashboardDataInternal();

    dashboardCache.data = data;
    dashboardCache.timestamp = nowTime;

    res.json(data);
  } catch (err) {
    next(err);
  }
};
