const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sfaController = require('../controllers/sfaController');

// Public review portal endpoints
router.get('/reviews/portal/:token', sfaController.getReviewPortal);
router.post('/reviews/portal/:token', sfaController.submitReview);

// Protected SFA endpoints
router.use(auth);

// Route Planner & Optimization
router.get('/routes', sfaController.getRoutes);
router.post('/routes', sfaController.createRoute);
router.put('/routes/:id', sfaController.updateRoute);
router.post('/routes/optimize', sfaController.optimizeRoute);

// Customer Visits
router.post('/visits/check-in', sfaController.checkInVisit);
router.post('/visits/check-out', sfaController.checkOutVisit);
router.get('/visits', sfaController.getVisits);

// GPS Live Tracking
router.post('/tracking/ping', sfaController.pingLocation);
router.get('/tracking/live', sfaController.getLiveTracking);
router.get('/tracking/history/:salesmanId/:date', sfaController.getTrackingHistory);

// Performance Analytics
router.get('/analytics', sfaController.getSfaAnalytics);

module.exports = router;
