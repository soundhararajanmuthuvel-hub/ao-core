const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
  createPackingConversion,
  getPackingConversions,
  reversePackingConversion,
} = require('../controllers/packingConversionController');

// All endpoints require auth and admin/manufacturing manager roles
router.use(auth, authorize('admin', 'Super Admin', 'Manufacturing Manager'));

router.get('/', getPackingConversions);
router.post('/', createPackingConversion);
router.post('/:id/reverse', reversePackingConversion);

module.exports = router;
