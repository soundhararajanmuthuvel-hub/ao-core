const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getRecipes, 
  getRecipe, 
  createRecipe, 
  updateRecipe, 
  deleteRecipe, 
  getEntries, 
  getEntry, 
  createEntry, 
  updateEntry, 
  deleteEntry, 
  getReport,
  getAvailableBulkBatches,
  getProductPackSizes,
  createProductPackSize,
  updateProductPackSize,
  deleteProductPackSize,
  reverseEntry
} = require('../controllers/repackController');

// All routes require authentication
router.use(auth);

// Bulk Batches & Predefined Pack Sizes
router.get('/available-bulk-batches', getAvailableBulkBatches);
router.get('/pack-sizes/:productId', getProductPackSizes);
router.post('/pack-sizes', createProductPackSize);
router.put('/pack-sizes/:id', updateProductPackSize);
router.delete('/pack-sizes/:id', deleteProductPackSize);

// Recipes Routes
router.get('/recipes', getRecipes);
router.get('/recipes/:id', getRecipe);
router.post('/recipes', createRecipe);
router.put('/recipes/:id', updateRecipe);
router.delete('/recipes/:id', deleteRecipe);

// Repack Entries, Void Reversal & Report Routes
router.get('/', getEntries);
router.get('/report', getReport);
router.get('/:id', getEntry);
router.post('/', createEntry);
router.post('/:id/reverse', reverseEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

module.exports = router;
