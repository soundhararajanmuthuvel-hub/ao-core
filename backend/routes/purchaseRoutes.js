const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { getPurchases, createPurchase, deletePurchase } = require('../controllers/purchaseController');

router.use(auth, authorize('admin'));
router.get('/', getPurchases);
router.post('/', createPurchase);
router.delete('/:id', deletePurchase);

module.exports = router;
