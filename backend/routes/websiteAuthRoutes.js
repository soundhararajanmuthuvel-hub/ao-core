const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const websiteRateLimiter = require('../middleware/websiteRateLimiter');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  guestCheckout,
} = require('../controllers/websiteAuthController');

router.use(websiteApiKeyAuth);

const authRateLimiter = websiteRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

module.exports = router;
