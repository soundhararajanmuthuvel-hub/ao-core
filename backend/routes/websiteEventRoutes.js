const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const websiteCustomerAuth = require('../middleware/websiteCustomerAuth');
const { logEvent } = require('../controllers/websiteEventController');

router.use(websiteApiKeyAuth);

router.post('/events', (req, res, next) => {
  if (req.headers.authorization) {
    return websiteCustomerAuth(req, res, next);
  }
  next();
}, logEvent);

module.exports = router;
