const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Self-contained temp file upload directory helper
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `whatsapp-${Date.now()}-${file.originalname}`);
  }
});

const uploadPdf = multer({
  storage: tempStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('pdf');

// Authentication middleware applied for all client-facing routes
router.use(auth);

// WhatsApp settings endpoints
router.get('/settings', whatsappController.getSettings);
router.put('/settings', whatsappController.updateSettings);
router.post('/settings/test', whatsappController.testConnection);

// Sending message endpoints
router.post('/send-pdf', uploadPdf, whatsappController.sendInvoicePdf);
router.post('/send-text', whatsappController.sendQuickText);
router.post('/send-document', whatsappController.sendDocument);

// Log monitoring endpoints
router.get('/logs', whatsappController.getLogs);
router.get('/stats', whatsappController.getStats);

// Public Webhook receiver (no auth required from WAHA)
router.post('/webhook', whatsappController.webhookReceiver);

module.exports = router;
