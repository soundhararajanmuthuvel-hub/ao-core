const express = require('express');
const router = express.Router();
const {
  handleProductWebhook,
  handleOrderWebhook,
  handleCustomerWebhook,
  handleInventoryWebhook
} = require('../controllers/integrationController');

router.post('/products', handleProductWebhook);
router.post('/orders', handleOrderWebhook);
router.post('/customers', handleCustomerWebhook);
router.post('/inventory', handleInventoryWebhook);

module.exports = router;
