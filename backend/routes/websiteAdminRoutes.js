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
  generateProductAIContent,
} = require('../controllers/websiteAdminController');

const cloudinaryService = require('../services/cloudinaryService');

// Multer memory storage for website product image uploads to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file max
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/avif'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Only JPG, JPEG, PNG, WEBP, and AVIF images up to 10MB are allowed.'), false);
    }
  },
});

// All website admin routes require AO Core ERP Admin Auth
router.use(auth);

// API Key Management
router.get('/api-key', getApiKey);
router.post('/api-key/regenerate', regenerateApiKey);

// Cloudinary Diagnostic Health Endpoint
router.get('/cloudinary-health', async (req, res) => {
  const health = await cloudinaryService.checkHealth();
  const status = health.connected ? 200 : (health.error?.httpStatus || 500);
  res.status(status).json(health);
});

// Cloudinary Image upload endpoint
router.post('/upload-image', (req, res, next) => {
  upload.array('images', 10)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'Image exceeds maximum size of 10MB',
            code: 'FILE_TOO_LARGE',
            reason: 'File size exceeds maximum limit of 10MB.'
          });
        }
        return res.status(400).json({
          success: false,
          error: 'Upload validation error',
          code: 'MULTER_ERROR',
          reason: err.message
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format',
        code: 'INVALID_FILE_FORMAT',
        reason: err.message || 'Image upload failed.'
      });
    }
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided',
          code: 'NO_FILES_UPLOADED',
          reason: 'No image files uploaded.'
        });
      }
      
      const uploadResults = await Promise.all(
        req.files.map((file) => cloudinaryService.uploadImage(file.buffer))
      );

      const urls = uploadResults.map((r) => r.secure_url);
      const publicIds = uploadResults.map((r) => r.public_id);
      const imagesMetadata = uploadResults.map((r) => ({
        publicId: r.public_id,
        secureUrl: r.secure_url,
        width: r.width || 0,
        height: r.height || 0,
        format: r.format || 'jpg',
        bytes: r.bytes || 0,
        createdAt: r.created_at || new Date().toISOString()
      }));

      res.json({
        success: true,
        message: `${uploadResults.length} image(s) uploaded to Cloudinary successfully!`,
        urls,
        publicIds,
        metadata: imagesMetadata,
        data: uploadResults,
      });
    } catch (error) {
      console.error('[Cloudinary Upload Route Error]', error);
      const errCode = error.type === 'CLOUDINARY_AUTH_ERROR' ? 'CLOUDINARY_AUTH_FAILED' : (error.type || 'CLOUDINARY_UPLOAD_ERROR');
      res.status(200).json({
        success: false,
        error: error.message || 'Cloudinary upload failed',
        code: errCode,
        reason: error.reason || error.message || 'Cloudinary service error',
        suggestion: error.suggestion || 'Please verify Cloudinary credentials in Settings.',
      });
    }
  });
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

// Analytics & AI Assistant
router.get('/analytics', getAdminAnalytics);
router.post('/ai-generate', generateProductAIContent);

module.exports = router;
