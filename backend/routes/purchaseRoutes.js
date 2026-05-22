const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
} = require('../controllers/purchaseController');

router.use(auth, authorize('admin'));
router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post('/', createPurchase);
router.put('/:id', updatePurchase);
router.delete('/:id', deletePurchase);

module.exports = router;
