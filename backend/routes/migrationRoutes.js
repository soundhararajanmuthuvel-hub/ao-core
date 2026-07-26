const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { uploadDataFile } = require('../middleware/upload');

// Controller
const migrationController = require('../controllers/migrationController');

// Routes
router.post('/upload', auth, authorize('admin'), uploadDataFile, migrationController.analyzeUploadedFiles);
router.post('/execute', auth, authorize('admin'), migrationController.executeMigration);
router.get('/status/:jobId', auth, migrationController.getJobStatus);
router.get('/history', auth, authorize('admin'), migrationController.getMigrationHistory);
router.get('/logs/:id', auth, authorize('admin'), migrationController.getMigrationLogs);
router.post('/rollback/:id', auth, authorize('admin'), migrationController.rollbackMigration);
router.get('/export', auth, authorize('admin'), migrationController.exportBackup);
router.get('/error-report/:id', auth, authorize('admin'), migrationController.downloadErrorReport);
router.post('/restore', auth, authorize('admin'), uploadDataFile, migrationController.restoreBackup);

module.exports = router;
