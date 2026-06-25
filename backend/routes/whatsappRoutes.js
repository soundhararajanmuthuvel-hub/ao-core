const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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

// Public endpoints (no auth required)
router.post('/webhook', whatsappController.webhookReceiver);

router.post('/mock-crm', (req, res) => {
  const apiKey = req.headers['x-crm-api-key'] || req.body.apiKey;
  const secret = req.headers['x-crm-secret'] || req.body.secret;

  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API Key Missing' });
  }

  const referenceId = `crm_msg_${Date.now()}`;
  
  // Background status callback trigger simulation
  const defaultWebhook = `${req.protocol}://${req.get('host')}/api/whatsapp/webhook`;
  setTimeout(async () => {
    try {
      await axios.post(defaultWebhook, {
        referenceId,
        status: 'Delivered',
        timestamp: new Date().toISOString()
      }, { timeout: 3000 });
      console.log(`[Mock CRM Webhook Simulator] Status callback delivered for ${referenceId}`);
    } catch (_) {}
  }, 1500);

  res.json({
    success: true,
    message: 'WhatsApp Sent Successfully',
    referenceId,
    messageId: referenceId
  });
});

// Authenticated endpoints
router.use(auth);

// WhatsApp settings endpoints
router.get('/settings', whatsappController.getSettings);
router.put('/settings', whatsappController.updateSettings);
router.post('/settings/test', whatsappController.testConnection);
router.post('/settings/test-message', whatsappController.sendTestMessage);
router.post('/settings/test-catalogue', whatsappController.sendTestCatalogue);
router.post('/settings/test-invoice', whatsappController.sendTestInvoice);

// Sending message endpoints
router.post('/send-pdf', uploadPdf, whatsappController.sendInvoicePdf);
router.post('/send-text', whatsappController.sendQuickText);
router.post('/send-document', whatsappController.sendDocument);

// Log monitoring endpoints
router.get('/logs', whatsappController.getLogs);
router.post('/logs/retry-failed', whatsappController.retryFailed);
router.get('/stats', whatsappController.getStats);

module.exports = router;
