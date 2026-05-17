const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { getDashboard } = require('../controllers/analyticsController');

router.use(auth, authorize('admin'));
router.get('/dashboard', getDashboard);

module.exports = router;
