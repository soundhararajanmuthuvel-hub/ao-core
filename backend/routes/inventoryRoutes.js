const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
  getMovements,
  adjustStock,
  repack,
  manufacturing,
  getReport,
  getLowStockAlerts,
  getProductBatches,
  getStockLossRegister,
  createStockLoss,
  getLossDashboard,
} = require('../controllers/inventoryController');

router.use(auth, authorize('admin'));
router.get('/low-stock-alerts', getLowStockAlerts);
router.get('/movements', getMovements);
router.get('/report', getReport);
router.get('/products/:id/batches', getProductBatches);
router.get('/loss/dashboard', getLossDashboard);
router.get('/loss', getStockLossRegister);
router.post('/loss', createStockLoss);
router.post('/adjust', adjustStock);
router.post('/repack', repack);
router.post('/manufacturing', manufacturing);

module.exports = router;
