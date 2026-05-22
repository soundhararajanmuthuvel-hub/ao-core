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

/* ==============================
   TEST ROUTE
============================== */
router.get('/test/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: '✅ Purchase Route Working',
  });
});

/* ==============================
   AUTH MIDDLEWARE
============================== */
router.use(auth);

/* ==============================
   GET ALL PURCHASES
============================== */
router.get(
  '/',
  authorize('admin', 'manager'),
  getPurchases
);

/* ==============================
   GET SINGLE PURCHASE
============================== */
router.get(
  '/:id',
  authorize('admin', 'manager'),
  getPurchaseById
);

/* ==============================
   CREATE PURCHASE
============================== */
router.post(
  '/',
  authorize('admin'),
  createPurchase
);

/* ==============================
   UPDATE PURCHASE
============================== */
router.put(
  '/:id',
  authorize('admin'),
  updatePurchase
);

/* ==============================
   DELETE PURCHASE
============================== */
router.delete(
  '/:id',
  authorize('admin'),
  deletePurchase
);

module.exports = router;