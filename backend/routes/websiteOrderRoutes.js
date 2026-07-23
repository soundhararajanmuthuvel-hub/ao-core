const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const websiteCustomerAuth = require('../middleware/websiteCustomerAuth');
const websiteRateLimiter = require('../middleware/websiteRateLimiter');
const {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
} = require('../controllers/websiteOrderController');

// Webhook endpoint does NOT require API Key (it's called by Razorpay servers and authenticated via HMAC header)
router.post('/webhook', websiteRateLimiter({ windowMs: 1 * 60 * 1000, max: 100 }), handleWebhook);

// Public / Customer order creation routes require API key
router.post(
  '/create-order',
  websiteApiKeyAuth,
  (req, res, next) => {
    if (req.headers.authorization) {
      return websiteCustomerAuth(req, res, next);
    }
    next();
  },
  websiteRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  createRazorpayOrder
);

router.post('/verify', websiteApiKeyAuth, verifyPayment);

module.exports = router;
