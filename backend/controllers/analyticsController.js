const Product = require('../models/Product');
const Invoice = require('../models/Invoice');

exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [productCount, salesStats, todayStats, lowStockCount] = await Promise.all([
      Product.countDocuments(),
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            revenue: { $sum: '$grandTotal' },
            profit: {
              $sum: {
                $reduce: {
                  input: '$items',
                  initialValue: 0,
                  in: {
                    $add: [
                      '$$value',
                      {
                        $multiply: [
                          '$$this.qty',
                          { $subtract: ['$$this.unitPrice', { $ifNull: ['$$this.purchasePrice', 0] }] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { date: { $gte: today, $lt: tomorrow } } },
        {
          $group: {
            _id: null,
            todaySales: { $sum: '$grandTotal' },
            todayOrders: { $sum: 1 },
          },
        },
      ]),
      Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    ]);

    const stats = salesStats[0] || { totalSales: 0, revenue: 0, profit: 0 };
    const todayData = todayStats[0] || { todaySales: 0, todayOrders: 0 };

    const monthlyRevenue = await Invoice.aggregate([
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          revenue: { $sum: '$grandTotal' },
          profit: {
            $sum: {
              $reduce: {
                input: '$items',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $multiply: [
                        '$$this.qty',
                        { $subtract: ['$$this.unitPrice', { $ifNull: ['$$this.purchasePrice', 0] }] },
                      ],
                    },
                  ],
                },
              },
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    const topProducts = await Invoice.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    const salesTrend = await Invoice.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    res.json({
      cards: {
        totalProducts: productCount,
        totalSales: stats.totalSales,
        revenue: stats.revenue,
        profit: stats.profit,
        todaySales: todayData.todaySales,
        todayOrders: todayData.todayOrders,
        lowStockCount,
      },
      charts: {
        monthlyRevenue: monthlyRevenue.map((m) => ({
          label: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
          revenue: m.revenue,
          profit: m.profit,
          orders: m.orders,
        })),
        topProducts: topProducts.map((p) => ({
          name: p.name || 'Unknown',
          qty: p.totalQty,
          revenue: p.revenue,
        })),
        salesTrend: salesTrend.map((s) => ({ date: s._id, total: s.total, count: s.count })),
      },
    });
  } catch (err) {
    next(err);
  }
};
