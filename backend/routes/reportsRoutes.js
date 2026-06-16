const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
  salesReport,
  purchasesReport,
  purchaseGstRegister,
  purchaseGstItc,
  purchaseGstAnalytics,
  purchaseGstMonthlySummary,
  purchaseGstReconciliation,
  dailyReport,
  shippingReport,
  shippingCostReport,
  procurementReport,
  salesGstr1Report,
  salesGstB2bReport,
  salesGstB2cReport,
  salesGstHsnReport,
  salesGstRegister,
  salesGstSummaryReport,
} = require('../controllers/reportsController');

router.use(auth, authorize('admin'));
router.get('/sales', salesReport);
router.get('/purchases', purchasesReport);
router.get('/gst/purchase-register', purchaseGstRegister);
router.get('/gst/itc', purchaseGstItc);
router.get('/gst/analytics', purchaseGstAnalytics);
router.get('/gst/monthly', purchaseGstMonthlySummary);
router.get('/gst/reconciliation', purchaseGstReconciliation);
router.get('/gst/gstr-1', salesGstr1Report);
router.get('/gst/b2b', salesGstB2bReport);
router.get('/gst/b2c', salesGstB2cReport);
router.get('/gst/hsn-summary', salesGstHsnReport);
router.get('/gst/sales-register', salesGstRegister);
router.get('/gst/summary', salesGstSummaryReport);
router.get('/daily', dailyReport);
router.get('/shipping', shippingReport);
router.get('/shipping-costs', shippingCostReport);
router.get('/procurement/:type', procurementReport);

module.exports = router;
