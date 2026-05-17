const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { globalSearch } = require('../controllers/searchController');

router.use(auth);
router.get('/', globalSearch);

module.exports = router;
