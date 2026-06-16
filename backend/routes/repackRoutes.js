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
  getReport 
} = require('../controllers/repackController');

// All routes require authentication
router.use(auth);

// Recipes Routes
router.get('/recipes', getRecipes);
router.get('/recipes/:id', getRecipe);
router.post('/recipes', createRecipe);
router.put('/recipes/:id', updateRecipe);
router.delete('/recipes/:id', deleteRecipe);

// Repack Entries & Report Routes
router.get('/', getEntries);
router.get('/report', getReport);
router.get('/:id', getEntry);
router.post('/', createEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

module.exports = router;
