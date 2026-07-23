const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const websiteCustomerAuth = require('../middleware/websiteCustomerAuth');
const {
  getMyOrders,
  getMyOrderById,
  getAddresses,
  addOrUpdateAddress,
  getWishlist,
  toggleWishlist,
  syncCart,
} = require('../controllers/websiteAccountController');

router.use(websiteApiKeyAuth);

// Order history (Customer JWT required)
router.get('/orders', websiteCustomerAuth, getMyOrders);
router.get('/orders/:id', websiteCustomerAuth, getMyOrderById);

// Address book (Customer JWT required)
router.get('/addresses', websiteCustomerAuth, getAddresses);
router.post('/addresses', websiteCustomerAuth, addOrUpdateAddress);

// Wishlist (Customer JWT required)
router.get('/wishlist', websiteCustomerAuth, getWishlist);
router.post('/wishlist', websiteCustomerAuth, toggleWishlist);

// Cart sync (Customer JWT required or guest session)
router.post('/cart/sync', (req, res, next) => {
  if (req.headers.authorization) {
    return websiteCustomerAuth(req, res, next);
  }
  next();
}, syncCart);

module.exports = router;
