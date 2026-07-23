const express = require('express');
const router = express.Router();
const websiteApiKeyAuth = require('../middleware/websiteApiKeyAuth');
const websiteCustomerAuth = require('../middleware/websiteCustomerAuth');
const {
  submitReferral,
  getMyReferrals,
  getMyCode,
} = require('../controllers/websiteReferralController');

router.use(websiteApiKeyAuth);

router.post('/submit', websiteCustomerAuth, submitReferral);
router.get('/my-referrals', websiteCustomerAuth, getMyReferrals);
router.get('/my-code', websiteCustomerAuth, getMyCode);

module.exports = router;
