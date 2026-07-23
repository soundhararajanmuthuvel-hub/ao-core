const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const { calculateShipping, validateCoupon } = require('../controllers/websiteShippingCouponController');

router.use(websiteApiKeyAuth);

router.post('/shipping/calculate', calculateShipping);
router.post('/coupons/validate', validateCoupon);

module.exports = router;
