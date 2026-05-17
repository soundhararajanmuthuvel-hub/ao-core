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
} = require('../controllers/inventoryController');

router.use(auth, authorize('admin'));
router.get('/movements', getMovements);
router.get('/report', getReport);
router.post('/adjust', adjustStock);
router.post('/repack', repack);
router.post('/manufacturing', manufacturing);

module.exports = router;
