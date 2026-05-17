const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { salesReport, purchasesReport, dailyReport } = require('../controllers/reportsController');

router.use(auth, authorize('admin'));
router.get('/sales', salesReport);
router.get('/purchases', purchasesReport);
router.get('/daily', dailyReport);

module.exports = router;
