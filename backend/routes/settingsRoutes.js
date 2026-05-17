const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { uploadLogo } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo: uploadLogoCtrl } = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/', auth, authorize('admin'), updateSettings);
router.post('/logo', auth, authorize('admin'), uploadLogo, uploadLogoCtrl);

module.exports = router;
