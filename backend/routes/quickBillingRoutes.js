const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createQuickBill, getQuickBillingStats } = require('../controllers/quickBillingController');

router.use(auth);
router.get('/stats', getQuickBillingStats);
router.post('/', createQuickBill);

module.exports = router;
