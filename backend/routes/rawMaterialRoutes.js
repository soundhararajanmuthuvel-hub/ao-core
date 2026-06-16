const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/auth'); // Can use same auth middleware as check
const {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  purchaseMaterial,
  adjustStock,
  getMovements,
  getReport,
} = require('../controllers/rawMaterialController');

// All routes require auth
router.use(auth);

router.get('/', getMaterials);
router.post('/', createMaterial);
router.put('/:id', updateMaterial);
router.delete('/:id', deleteMaterial);

router.post('/purchase', purchaseMaterial);
router.post('/adjust', adjustStock);
router.get('/movements', getMovements);
router.get('/report', getReport);

module.exports = router;
