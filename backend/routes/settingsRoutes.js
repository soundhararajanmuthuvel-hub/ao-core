const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { uploadLogo } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo: uploadLogoCtrl, uploadLogoToWordPress, getSettingsLogo } = require('../controllers/settingsController');
const {
  getCounts,
  verifyPassword,
  backupDatabase,
  resetDemoData,
  clearTransactions,
  factoryReset,
} = require('../controllers/databaseController');

// Super Admin Authorization middleware helper
const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Super Admin') {
    return res.status(403).json({ message: 'Access denied: Super Admin only' });
  }
  next();
};

router.get('/logo', getSettingsLogo);
router.get('/', getSettings);
router.put('/', auth, authorize('admin'), updateSettings);
router.post('/logo', auth, authorize('admin'), uploadLogo, uploadLogoCtrl);
router.post('/upload-wp-logo', auth, authorize('admin'), uploadLogo, uploadLogoToWordPress);

// Database Management endpoints
router.get('/database/counts', auth, isSuperAdmin, getCounts);
router.get('/database/backup', auth, isSuperAdmin, backupDatabase);
router.post('/database/verify-password', auth, isSuperAdmin, verifyPassword);
router.post('/database/reset-demo', auth, isSuperAdmin, resetDemoData);
router.post('/database/clear-transactions', auth, isSuperAdmin, clearTransactions);
router.post('/database/factory-reset', auth, isSuperAdmin, factoryReset);

module.exports = router;

