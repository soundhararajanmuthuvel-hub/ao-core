const { Op } = require('sequelize');
const Route = require('../models/Route');
const Visit = require('../models/Visit');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const CustomerReview = require('../models/CustomerReview');
const SalesmanLocation = require('../models/SalesmanLocation');
const Lead = require('../models/Lead');
const { getSettings } = require('../utils/helpers');

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

// TSP Nearest Neighbor Route Optimization
exports.optimizeRoute = async (req, res, next) => {
  try {
    const { customerIds, startLat, startLng } = req.body;
    if (!customerIds || !customerIds.length) {
      return res.status(400).json({ message: 'Customer list is empty' });
    }

    const customers = await Customer.findAll({
      where: { id: customerIds }
    });

    let currentLat = startLat !== undefined ? Number(startLat) : 11.0168; // default Coimbatore warehouse
    let currentLng = startLng !== undefined ? Number(startLng) : 76.9558;

    const unvisited = [...customers];
    const sequence = [];
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const cust = unvisited[i];
        if (cust.latitude === null || cust.longitude === null) {
          // If customer has no coords, put it at distance 0 (unmapped)
          closestIdx = i;
          minDistance = 0;
          break;
        }
        const dist = haversineDistance(currentLat, currentLng, Number(cust.latitude), Number(cust.longitude));
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      const nextCust = unvisited.splice(closestIdx, 1)[0];
      sequence.push(nextCust);
      totalDistance += minDistance === Infinity ? 0 : minDistance;
      if (nextCust.latitude !== null && nextCust.longitude !== null) {
        currentLat = Number(nextCust.latitude);
        currentLng = Number(nextCust.longitude);
      }
    }

    // travel time estimate (avg 35 km/h + 15 min per visit)
    const travelTimeMin = Math.round((totalDistance / 35) * 60);
    const totalDurationMin = travelTimeMin + (sequence.length * 15);

    res.json({
      sequence: sequence.map(c => c.id),
      customers: sequence,
      totalDistance: Number(totalDistance.toFixed(2)),
      estimatedTravelTime: travelTimeMin,
      totalDuration: totalDurationMin
    });
  } catch (err) {
    next(err);
  }
};

// Route Management
exports.getRoutes = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.salesmanId) query.salesmanId = req.query.salesmanId;
    if (req.query.date) query.date = req.query.date;

    const routes = await Route.findAll({
      where: query,
      include: [{ model: User, as: 'salesman', attributes: ['id', 'name', 'email'] }],
      order: [['date', 'DESC']]
    });
    res.json(routes);
  } catch (err) {
    next(err);
  }
};

exports.createRoute = async (req, res, next) => {
  try {
    const { name, salesmanId, date, customerSequence, totalDistance, totalDuration } = req.body;
    if (!name || !date) {
      return res.status(400).json({ message: 'Name and date are required' });
    }

    const route = await Route.create({
      name,
      salesmanId: salesmanId || req.user.id,
      date,
      customerSequence: customerSequence || [],
      totalDistance: totalDistance || 0,
      totalDuration: totalDuration || 0,
      isCompleted: false
    });

    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
};

exports.updateRoute = async (req, res, next) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    await route.update(req.body);
    res.json(route);
  } catch (err) {
    next(err);
  }
};

// Salesman Visit Check-In / Check-Out
exports.checkInVisit = async (req, res, next) => {
  try {
    const { customerId, leadId, latitude, longitude } = req.body;
    if ((!customerId && !leadId) || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Customer ID or Lead ID and GPS coordinates are required' });
    }

    let target = null;
    let targetType = '';
    if (customerId) {
      target = await Customer.findByPk(customerId);
      targetType = 'customer';
    } else if (leadId) {
      target = await Lead.findByPk(leadId);
      targetType = 'lead';
    }

    if (!target) return res.status(404).json({ message: `${targetType === 'customer' ? 'Customer' : 'Lead'} not found` });

    const settings = await getSettings();
    const radiusLimit = settings.checkInRadius || 100; // in meters

    let distMeters = null;
    if (target.latitude !== null && target.longitude !== null) {
      const distKm = haversineDistance(Number(latitude), Number(longitude), Number(target.latitude), Number(target.longitude));
      distMeters = distKm * 1000;

      if (distMeters > radiusLimit) {
        return res.status(400).json({
          message: `Check-in denied. You are ${Math.round(distMeters)} meters away. Limit is ${radiusLimit} meters.`
        });
      }
    } else {
      // Auto-save target location if coordinates are empty
      target.latitude = latitude;
      target.longitude = longitude;
      await target.save();
      distMeters = 0;
    }

    // Check if there is an active check-in that wasn't closed
    const activeVisit = await Visit.findOne({
      where: {
        salesmanId: req.user.id,
        checkOutTime: null
      }
    });

    if (activeVisit) {
      // Force auto-checkout for previous visit to keep DB clean
      activeVisit.checkOutTime = new Date();
      activeVisit.duration = Math.round((new Date() - new Date(activeVisit.checkInTime)) / (1000 * 60));
      activeVisit.status = 'Visited';
      await activeVisit.save();
    }

    const visit = await Visit.create({
      salesmanId: req.user.id,
      customerId: customerId || null,
      leadId: leadId || null,
      checkInTime: new Date(),
      latitude,
      longitude,
      status: 'Visited',
      distanceFromCustomer: distMeters
    });

    res.status(201).json(visit);
  } catch (err) {
    next(err);
  }
};

exports.checkOutVisit = async (req, res, next) => {
  try {
    const { visitId, status, notes, photo } = req.body;
    let visit = null;

    if (visitId) {
      visit = await Visit.findByPk(visitId);
    } else {
      // Find latest unclosed visit for the logged-in salesman
      visit = await Visit.findOne({
        where: { salesmanId: req.user.id, checkOutTime: null },
        order: [['checkInTime', 'DESC']]
      });
    }

    if (!visit) {
      return res.status(404).json({ message: 'No active check-in visit found for this checkout request.' });
    }

    const checkOut = new Date();
    const durationMin = Math.round((checkOut - new Date(visit.checkInTime)) / (1000 * 60));

    await visit.update({
      checkOutTime: checkOut,
      duration: durationMin,
      status: status || 'Visited',
      notes: notes || '',
      photo: photo || null
    });

    res.json(visit);
  } catch (err) {
    next(err);
  }
};

exports.logManualVisit = async (req, res, next) => {
  try {
    const { customerId, visitDate, notes } = req.body;
    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const parsedDate = visitDate ? new Date(visitDate) : new Date();

    const visit = await Visit.create({
      salesmanId: req.user.id,
      customerId,
      checkInTime: parsedDate,
      checkOutTime: parsedDate,
      duration: 0,
      latitude: customer.latitude !== null ? Number(customer.latitude) : 0,
      longitude: customer.longitude !== null ? Number(customer.longitude) : 0,
      status: 'Visited',
      notes: notes || '',
      distanceFromCustomer: 0
    });

    customer.lastVisitDate = parsedDate;
    await customer.save();

    res.status(201).json(visit);
  } catch (err) {
    next(err);
  }
};

exports.getVisits = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.salesmanId) query.salesmanId = req.query.salesmanId;
    if (req.query.customerId) query.customerId = req.query.customerId;
    if (req.query.leadId) query.leadId = req.query.leadId;
    if (req.query.status) query.status = req.query.status;

    const visits = await Visit.findAll({
      where: query,
      include: [
        { model: User, as: 'salesman', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'tier', 'territory'] },
        { model: Lead, as: 'lead', attributes: ['id', 'shopName', 'mobileNumber', 'area'] }
      ],
      order: [['checkInTime', 'DESC']]
    });
    res.json(visits);
  } catch (err) {
    next(err);
  }
};

// Location Tracking
exports.pingLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Coordinates are required' });
    }

    const log = await SalesmanLocation.create({
      salesmanId: req.user.id,
      latitude,
      longitude,
      timestamp: new Date()
    });

    res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
};

exports.getLiveTracking = async (req, res, next) => {
  try {
    // Find the latest location ping for each user with role Salesman or Sales Executive
    const salesmen = await User.findAll({
      where: { role: ['Salesman', 'Sales Executive'] },
      attributes: ['id', 'name', 'role', 'isActive']
    });

    const liveLogs = [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const s of salesmen) {
      const lastPing = await SalesmanLocation.findOne({
        where: { salesmanId: s.id },
        order: [['timestamp', 'DESC']]
      });

      const todayVisits = await Visit.count({
        where: {
          salesmanId: s.id,
          checkInTime: { [Op.gte]: todayStart }
        }
      });

      // Find latest visit today to determine currentCustomer and lastActivity
      const latestVisit = await Visit.findOne({
        where: {
          salesmanId: s.id,
          checkInTime: { [Op.gte]: todayStart }
        },
        order: [['checkInTime', 'DESC']],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }]
      });

      let currentCustomer = 'None (Idle)';
      if (latestVisit && latestVisit.checkOutTime === null && latestVisit.customer) {
        currentCustomer = latestVisit.customer.name;
      }

      // Calculate last activity string
      let lastActivity = 'No activity today';
      let lastActivityTime = null;

      if (lastPing) {
        const pingTime = new Date(lastPing.timestamp);
        lastActivity = `GPS Ping at ${pingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        lastActivityTime = pingTime;
      }

      if (latestVisit) {
        const checkInDate = new Date(latestVisit.checkInTime);
        const checkOutDate = latestVisit.checkOutTime ? new Date(latestVisit.checkOutTime) : null;
        
        if (!lastActivityTime || checkInDate > lastActivityTime) {
          lastActivity = `Checked in at ${latestVisit.customer?.name || 'Customer'} at ${checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          lastActivityTime = checkInDate;
        }
        
        if (checkOutDate && (!lastActivityTime || checkOutDate > lastActivityTime)) {
          lastActivity = `Checked out from ${latestVisit.customer?.name || 'Customer'} at ${checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          lastActivityTime = checkOutDate;
        }
      }

      // Calculate distance covered today by summing consecutive pings
      const todayPings = await SalesmanLocation.findAll({
        where: {
          salesmanId: s.id,
          timestamp: { [Op.gte]: todayStart }
        },
        order: [['timestamp', 'ASC']]
      });

      let distanceCoveredToday = 0.0;
      for (let i = 1; i < todayPings.length; i++) {
        const p1 = todayPings[i - 1];
        const p2 = todayPings[i];
        distanceCoveredToday += haversineDistance(
          Number(p1.latitude), Number(p1.longitude),
          Number(p2.latitude), Number(p2.longitude)
        );
      }

      liveLogs.push({
        salesman: s,
        lastKnownLocation: lastPing,
        visitsToday: todayVisits,
        currentCustomer,
        lastActivity,
        distanceCoveredToday: parseFloat(distanceCoveredToday.toFixed(2))
      });
    }

    res.json(liveLogs);
  } catch (err) {
    next(err);
  }
};

exports.getTrackingHistory = async (req, res, next) => {
  try {
    const { salesmanId, date } = req.params;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const logs = await SalesmanLocation.findAll({
      where: {
        salesmanId,
        timestamp: { [Op.between]: [start, end] }
      },
      order: [['timestamp', 'ASC']]
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

// Customer Review Portal
exports.getReviewPortal = async (req, res, next) => {
  try {
    const review = await CustomerReview.findOne({
      where: { token: req.params.token },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber', 'grandTotal', 'date'] }
      ]
    });

    if (!review) return res.status(404).json({ message: 'Invalid or expired review token' });
    res.json(review);
  } catch (err) {
    next(err);
  }
};

exports.submitReview = async (req, res, next) => {
  try {
    const review = await CustomerReview.findOne({
      where: { token: req.params.token }
    });

    if (!review) return res.status(404).json({ message: 'Invalid or expired review token' });
    if (review.status === 'Submitted') {
      return res.status(400).json({ message: 'Review has already been submitted' });
    }

    const { productRating, deliveryRating, salesmanRating, overallRating, reviewText } = req.body;

    await review.update({
      productRating: Number(productRating || 5),
      deliveryRating: Number(deliveryRating || 5),
      salesmanRating: Number(salesmanRating || 5),
      overallRating: Number(overallRating || 5),
      reviewText: reviewText || '',
      status: 'Submitted'
    });

    res.json({ message: 'Thank you for your feedback!', review });
  } catch (err) {
    next(err);
  }
};

// Salesman Performance Analytics
exports.getSfaAnalytics = async (req, res, next) => {
  try {
    const salesmanId = req.query.salesmanId || req.user.id;
    const dateLimit = req.query.date || new Date().toISOString().split('T')[0];

    const start = new Date(dateLimit);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateLimit);
    end.setHours(23, 59, 59, 999);

    const totalCustomers = await Customer.count({
      where: { assignedSalesmanId: salesmanId }
    });

    const visits = await Visit.findAll({
      where: {
        salesmanId,
        checkInTime: { [Op.between]: [start, end] }
      }
    });

    const orderCount = await Order.count({
      where: {
        customerId: { [Op.in]: visits.map(v => v.customerId) },
        orderDate: { [Op.between]: [start, end] }
      }
    });

    let totalDuration = 0;
    visits.forEach(v => {
      totalDuration += Number(v.duration || 0);
    });

    const conversionRate = visits.length > 0 ? Number(((orderCount / visits.length) * 100).toFixed(1)) : 0;

    res.json({
      date: dateLimit,
      assignedCustomers: totalCustomers,
      visitedCustomers: visits.length,
      ordersGenerated: orderCount,
      orderConversionRate: conversionRate,
      timeSpentInFieldMin: totalDuration,
      averageDurationPerVisitMin: visits.length > 0 ? Math.round(totalDuration / visits.length) : 0
    });
  } catch (err) {
    next(err);
  }
};
