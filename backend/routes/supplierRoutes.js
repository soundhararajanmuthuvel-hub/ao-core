const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDashboard,
  getSupplierPurchases,
  paySupplierPurchase,
} = require('../controllers/supplierController');

router.use(auth);

router.get('/dashboard', getSupplierDashboard);
router.get('/purchases', getSupplierPurchases);
router.put('/purchases/:id/pay', paySupplierPurchase);

router.get('/', getSuppliers);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

module.exports = router;
