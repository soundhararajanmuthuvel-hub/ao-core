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
} = require('../controllers/productController');

router.use(auth);
router.get('/', getProducts);
router.get('/low-stock', getLowStock);
router.get('/categories', getCategories);
router.get('/:id/history', getStockHistory);
router.get('/:id', getProduct);
router.post('/', uploadProduct, createProduct);
router.put('/:id', uploadProduct, updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
