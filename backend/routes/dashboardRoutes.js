const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getHomeDashboard } = require('../controllers/dashboardController');

router.get('/home', auth, getHomeDashboard);

module.exports = router;
