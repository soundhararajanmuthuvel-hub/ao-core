const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const {
  getApiKey,
  regenerateApiKey,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminOrders,
  updateAdminOrderStatus,
  refundAdminOrder,
  getAdminCustomers,
  resetAdminCustomerPassword,
  getAdminTestimonials,
  createAdminTestimonial,
  updateAdminTestimonial,
  deleteAdminTestimonial,
  getAdminReviews,
  createAdminReview,
  updateAdminReview,
  deleteAdminReview,
  getAdminReferrals,
  approveAdminReferral,
  rejectAdminReferral,
  getAdminShippingRules,
  createAdminShippingRule,
  updateAdminShippingRule,
  deleteAdminShippingRule,
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  getAdminAnalytics,
} = require('../controllers/websiteAdminController');

// Multer storage for website product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `website_prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  },
});
const upload = multer({ storage });

// All website admin routes require AO Core ERP Admin Auth
router.use(auth);

// API Key Management
router.get('/api-key', getApiKey);
router.post('/api-key/regenerate', regenerateApiKey);

// Image upload
router.post('/upload-image', upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files uploaded.' });
    }
    const fileUrls = req.files.map((file) => `/uploads/${file.filename}`);
    res.json({ success: true, urls: fileUrls });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});

// Product Management
router.get('/products', getAdminProducts);
router.post('/products', createAdminProduct);
router.put('/products/:id', updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);

// Order Management & Refunds
router.get('/orders', getAdminOrders);
router.put('/orders/:id/status', updateAdminOrderStatus);
router.post('/orders/:id/refund', refundAdminOrder);

// Customer Management & Reset Password
router.get('/customers', getAdminCustomers);
router.post('/customers/:id/reset-password', resetAdminCustomerPassword);

// Testimonials & Reviews
router.get('/testimonials', getAdminTestimonials);
router.post('/testimonials', createAdminTestimonial);
router.put('/testimonials/:id', updateAdminTestimonial);
router.delete('/testimonials/:id', deleteAdminTestimonial);

router.get('/reviews', getAdminReviews);
router.post('/reviews', createAdminReview);
router.put('/reviews/:id', updateAdminReview);
router.delete('/reviews/:id', deleteAdminReview);

// Referrals Management
router.get('/referrals', getAdminReferrals);
router.post('/referrals/:id/approve', approveAdminReferral);
router.post('/referrals/:id/reject', rejectAdminReferral);

// Shipping & Coupons
router.get('/shipping-rules', getAdminShippingRules);
router.post('/shipping-rules', createAdminShippingRule);
router.put('/shipping-rules/:id', updateAdminShippingRule);
router.delete('/shipping-rules/:id', deleteAdminShippingRule);

router.get('/coupons', getAdminCoupons);
router.post('/coupons', createAdminCoupon);
router.put('/coupons/:id', updateAdminCoupon);
router.delete('/coupons/:id', deleteAdminCoupon);

// Analytics
router.get('/analytics', getAdminAnalytics);

module.exports = router;
