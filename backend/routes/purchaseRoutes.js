const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { uploadPurchaseInvoice } = require('../middleware/upload');
const {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseSuggestions,
  ignorePurchaseSuggestion,
} = require('../controllers/purchaseController');

router.use(auth, authorize('admin'));

router.get('/suggestions', getPurchaseSuggestions);
router.post('/suggestions/ignore', ignorePurchaseSuggestion);

router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post('/', uploadPurchaseInvoice, createPurchase);
router.put('/:id', updatePurchase);
router.delete('/:id', deletePurchase);

module.exports = router;
