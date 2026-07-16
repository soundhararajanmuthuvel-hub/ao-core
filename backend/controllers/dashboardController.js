const { Op, col } = require('sequelize');
const { sequelize } = require('../config/db');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Visit = require('../models/Visit');
const RawMaterial = require('../models/RawMaterial');
const SalesmanLocation = require('../models/SalesmanLocation');
const IntegrationConnection = require('../models/IntegrationConnection');
const IntegrationProduct = require('../models/IntegrationProduct');
const IntegrationCustomer = require('../models/IntegrationCustomer');
const IntegrationOrder = require('../models/IntegrationOrder');
const IntegrationCatalogue = require('../models/IntegrationCatalogue');

// Helper: Haversine distance in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const { getDashboardDataInternal } = require('./analyticsController');

exports.getHomeDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tenantId = req.user?.tenantId || 1;

    // Core Dashboard KPIs and Trends using shared helper
    const analytics = await getDashboardDataInternal();

    // Concurrent aggregation of Low Stock Lists, WooStats, and SFA analytics
    const [
      productsAlertList,
      rawMaterialsAlertList,
      wooStatsConnections,
      wooStatsLatestSync,
      wooProductsCount,
      wooCustomersCount,
      wooOrdersCount,
      salesmenList,
      todayVisitsCount,
      sfaAnalyticsSummary
    ] = await Promise.all([
      // 1. Low Stock Alerts list
      Product.findAll({
        where: { isArchived: false },
        attributes: ['id', 'name', 'sku', 'stock', 'lowStockThreshold', 'unit', 'productType'],
        raw: true
      }),
      RawMaterial.findAll({
        attributes: ['id', 'name', 'materialCode', 'stock', 'minStock', 'unit', 'category'],
        raw: true
      }),

      // 2. Integration connection stats
      IntegrationConnection.findAll({
        where: { tenantId },
        attributes: ['id', 'connectionStatus', 'lastSyncTime'],
        raw: true
      }),
      IntegrationConnection.findOne({
        where: { tenantId, lastSyncTime: { [Op.ne]: null } },
        order: [['lastSyncTime', 'DESC']],
        attributes: ['lastSyncTime'],
        raw: true
      }),
      IntegrationProduct.count({ where: { tenantId } }),
      IntegrationCustomer.count({ where: { tenantId } }),
      IntegrationOrder.count({ where: { tenantId } }),

      // 3. SFA Salesmen (for tracking pings)
      User.findAll({
        where: { role: ['Salesman', 'Sales Executive'] },
        attributes: ['id', 'name', 'role', 'isActive'],
        raw: true
      }),
      Visit.count({
        where: {
          checkInTime: { [Op.gte]: today }
        }
      }),
      // SFA general analytics metrics
      Customer.count()
    ]);

    // Format alerts lists
    const critical = [];
    const warning = [];
    const normal = [];

    productsAlertList.forEach((p) => {
      const stock = Number(p.stock || 0);
      const min = Number(p.lowStockThreshold || 0);
      const item = {
        id: `product:${p.id}`,
        itemId: p.id,
        itemType: 'product',
        name: p.name,
        sku: p.sku || 'N/A',
        stock,
        minStock: min,
        unit: p.unit || 'pcs',
        type: p.productType,
      };
      if (stock <= 0) critical.push(item);
      else if (stock <= min) warning.push(item);
      else normal.push(item);
    });

    rawMaterialsAlertList.forEach((r) => {
      const stock = Number(r.stock || 0);
      const min = Number(r.minStock || 0);
      const item = {
        id: `raw:${r.id}`,
        itemId: r.id,
        itemType: 'raw_material',
        name: r.name,
        sku: r.materialCode || 'N/A',
        stock,
        minStock: min,
        unit: r.unit || 'Kg',
        type: r.category,
      };
      if (stock <= 0) critical.push(item);
      else if (stock <= min) warning.push(item);
      else normal.push(item);
    });

    // Format WooCommerce stats
    const totalConnections = wooStatsConnections.length;
    const connectedConnections = wooStatsConnections.filter(c => c.connectionStatus === 'Connected').length;
    const failedConnections = wooStatsConnections.filter(c => c.connectionStatus === 'Failed').length;

    // Get live salesman tracking details
    const liveTrackingSalesmen = [];
    for (const s of salesmenList) {
      const lastPing = await SalesmanLocation.findOne({
        where: { salesmanId: s.id },
        order: [['timestamp', 'DESC']],
        raw: true
      });

      const salesmanVisits = await Visit.count({
        where: {
          salesmanId: s.id,
          checkInTime: { [Op.gte]: today }
        }
      });

      let lastActivity = 'No activity today';
      if (lastPing) {
        const pingTime = new Date(lastPing.timestamp);
        lastActivity = `GPS Ping at ${pingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      liveTrackingSalesmen.push({
        salesman: s,
        lastKnownLocation: lastPing,
        visitsToday: salesmanVisits,
        currentCustomer: 'None (Idle)',
        lastActivity,
        distanceCoveredToday: 0.0
      });
    }

    res.json({
      success: true,
      analytics, // contains cards, charts, outstanding metrics
      stockAlerts: {
        critical: critical.slice(0, 5),
        warning: warning.slice(0, 5),
        counts: {
          critical: critical.length,
          warning: warning.length,
          normal: normal.length
        }
      },
      wooStats: {
        totalIntegrations: totalConnections,
        connectedIntegrations: connectedConnections,
        failedIntegrations: failedConnections,
        lastSyncTime: wooStatsLatestSync ? wooStatsLatestSync.lastSyncTime : null,
        totalProducts: wooProductsCount,
        totalCustomers: wooCustomersCount,
        totalOrders: wooOrdersCount
      },
      sfaLive: {
        salesmenCount: salesmenList.length,
        todayVisitsCount,
        liveTracking: liveTrackingSalesmen
      },
      totalCustomerCount: sfaAnalyticsSummary
    });

  } catch (err) {
    next(err);
  }
};
