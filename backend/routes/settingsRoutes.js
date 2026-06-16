const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { uploadLogo } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo: uploadLogoCtrl, uploadLogoToWordPress } = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/', auth, authorize('admin'), updateSettings);
router.post('/logo', auth, authorize('admin'), uploadLogo, uploadLogoCtrl);
router.post('/upload-wp-logo', auth, authorize('admin'), uploadLogo, uploadLogoToWordPress);

module.exports = router;
