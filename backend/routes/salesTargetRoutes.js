const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const salesTargetController = require('../controllers/salesTargetController');

router.use(auth);

// CRUD configurations
router.get('/', salesTargetController.getTargets);
router.post('/', salesTargetController.createTarget);
router.put('/:id', salesTargetController.updateTarget);
router.delete('/:id', salesTargetController.deleteTarget);

// Dashboard metrics
router.get('/dashboard', salesTargetController.getTargetDashboard);

module.exports = router;
