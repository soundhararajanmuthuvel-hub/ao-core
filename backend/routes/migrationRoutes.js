const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');

// Multer Storage Configuration
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: 'uploads/' });

// Controller
const migrationController = require('../controllers/migrationController');

// Routes
router.post('/upload', auth, authorize('admin'), upload.single('file'), migrationController.analyzeUploadedFiles);
router.post('/execute', auth, authorize('admin'), migrationController.executeMigration);
router.get('/history', auth, authorize('admin'), migrationController.getMigrationHistory);
router.get('/logs/:id', auth, authorize('admin'), migrationController.getMigrationLogs);
router.post('/rollback/:id', auth, authorize('admin'), migrationController.rollbackMigration);
router.get('/export', auth, authorize('admin'), migrationController.exportBackup);
router.post('/restore', auth, authorize('admin'), upload.single('file'), migrationController.restoreBackup);

module.exports = router;
