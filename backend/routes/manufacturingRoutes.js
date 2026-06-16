const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getEntries,
  createEntry,
  updateEntry,
  reverseEntry,
  getPlanner,
  getDashboard,
} = require('../controllers/manufacturingController');

// All routes require auth
router.use(auth);

router.get('/dashboard', getDashboard);
router.get('/recipes', getRecipes);
router.post('/recipes', createRecipe);
router.put('/recipes/:id', updateRecipe);
router.delete('/recipes/:id', deleteRecipe);

router.get('/planner', getPlanner);
router.get('/entries', getEntries);
router.post('/entries', createEntry);
router.put('/entries/:id', updateEntry);
router.post('/entries/:id/reverse', reverseEntry);

module.exports = router;
