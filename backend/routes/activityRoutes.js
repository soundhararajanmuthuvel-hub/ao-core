const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { getActivity } = require('../controllers/activityController');

router.use(auth, authorize('admin'));
router.get('/', getActivity);

module.exports = router;
