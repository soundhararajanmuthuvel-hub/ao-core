const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getShipments,
  getShipment,
  createShipment,
  updateShipmentStatus,
  sendShipmentNotification,
  deleteShipment,
  getPublicShipmentStatus,
  getShippingAnalytics,
} = require('../controllers/shippingController');

// Public tracking route - DOES NOT require authentication
router.get('/public/track/:trackingNumber', getPublicShipmentStatus);

// Auth middleware for all subsequent routes
router.use(auth);

router.get('/', getShipments);
router.get('/analytics/dashboard', getShippingAnalytics);
router.get('/:id', getShipment);
router.post('/', createShipment);
router.put('/:id/status', updateShipmentStatus);
router.post('/:id/notify', sendShipmentNotification);
router.delete('/:id', deleteShipment);

module.exports = router;
