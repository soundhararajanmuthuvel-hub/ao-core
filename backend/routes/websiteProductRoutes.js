const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const { getProducts, getProductBySlug } = require('../controllers/websiteProductController');

router.use(websiteApiKeyAuth);

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);

module.exports = router;
