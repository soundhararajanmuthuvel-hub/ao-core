const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadProduct } = require('../middleware/upload');
const {
  getProducts,
  getLowStock,
  getCategories,
  getProduct,
  getStockHistory,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductDependenciesApi,
  restoreProduct,
  deleteProductPermanent,
  adjustProductStockToZero,
  updateWebsiteFields,
  updateBillingFields,
} = require('../controllers/productController');

router.use(auth);
router.get('/', getProducts);
router.get('/low-stock', getLowStock);
router.get('/categories', getCategories);
router.get('/:id/dependencies', getProductDependenciesApi);
router.get('/:id/history', getStockHistory);
router.get('/:id', getProduct);
router.post('/', uploadProduct, createProduct);
router.post('/:id/restore', restoreProduct);
router.post('/:id/adjust-zero', adjustProductStockToZero);
router.put('/:id', uploadProduct, updateProduct);
router.patch('/website', updateWebsiteFields);
router.patch('/billing', updateBillingFields);
router.patch('/:id/website', updateWebsiteFields);
router.patch('/:id/billing', updateBillingFields);
router.delete('/:id/permanent', deleteProductPermanent);
router.delete('/:id', deleteProduct);

module.exports = router;

