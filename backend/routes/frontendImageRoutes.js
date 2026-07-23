const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const { getImages, searchImages } = require('../controllers/frontendImageController');

// Optional API Key Middleware
const optionalAuth = (req, res, next) => {
  if (req.headers['x-api-key'] || req.headers['X-API-Key']) {
    return websiteApiKeyAuth(req, res, next);
  }
  next();
};

router.use(optionalAuth);

// GET /api/frontend/images or /api/website/images
router.get('/', getImages);

// GET /api/frontend/image/search?q= or /api/website/images/search?q=
router.get('/search', searchImages);

module.exports = router;
