const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const { getTestimonials, getProductReviews } = require('../controllers/websiteReviewController');

router.use(websiteApiKeyAuth);

router.get('/health', (req, res) => res.json({ success: true, status: 'OK', message: 'Website module is operational' }));
router.get('/testimonials', getTestimonials);
router.get('/products/:slug/reviews', getProductReviews);

module.exports = router;
