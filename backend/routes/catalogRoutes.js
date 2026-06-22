const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const catalogController = require('../controllers/catalogController');

// Public unauthenticated routes
router.get('/public', catalogController.getPublicCatalog);
router.get('/download/pdf', catalogController.downloadPdfCatalog);
router.get('/download/image/:productId', catalogController.downloadImageCatalog);

// Authenticated catalog routes
router.post('/share/whatsapp', auth, catalogController.sendCatalogWhatsApp);

module.exports = router;
