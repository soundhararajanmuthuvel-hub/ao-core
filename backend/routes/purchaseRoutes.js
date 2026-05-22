const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth');
const authorize = require('../middleware/role');

const {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
} = require('../controllers/purchaseController');

/* =================================
   MIDDLEWARE
================================= */

// Protect all routes
router.use(auth);

/* =================================
   ROUTES
================================= */

/**
 * @route   GET /api/purchases
 * @desc    Get all purchases
 * @access  Admin / Manager
 */
router.get(
  '/',
  authorize('admin', 'manager'),
  getPurchases
);

/**
 * @route   GET /api/purchases/:id
 * @desc    Get single purchase
 * @access  Admin / Manager
 */
router.get(
  '/:id',
  authorize('admin', 'manager'),
  getPurchaseById
);

/**
 * @route   POST /api/purchases
 * @desc    Create purchase
 * @access  Admin
 */
router.post(
  '/',
  authorize('admin'),
  createPurchase
);

/**
 * @route   PUT /api/purchases/:id
 * @desc    Update purchase
 * @access  Admin
 */
router.put(
  '/:id',
  authorize('admin'),
  updatePurchase
);

/**
 * @route   DELETE /api/purchases/:id
 * @desc    Delete purchase
 * @access  Admin
 */
router.delete(
  '/:id',
  authorize('admin'),
  deletePurchase
);

/* =================================
   TEST ROUTE
================================= */

router.get('/test/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: '✅ Purchase Route Working',
  });
});

module.exports = router;