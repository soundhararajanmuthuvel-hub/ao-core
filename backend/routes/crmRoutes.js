const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const crmController = require('../controllers/crmController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);

// CRM Dashboard Analytics
router.get('/dashboard', crmController.crmDashboard);

// Leads CRUD
router.get('/leads', crmController.getLeads);
router.get('/leads/:id', crmController.getLead);
router.post('/leads', crmController.createLead);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);

// AI Lead Importer Endpoints
router.post('/leads/import/extract-text', upload.single('file'), crmController.extractTextFromLeadFile);
router.post('/leads/import/analyze', crmController.analyzeLeadsText);
router.post('/leads/import/execute', crmController.importLeadsList);

// Lead Finder Simulated Search
router.get('/lead-finder', crmController.findSimulatedLeads);

// Lead Conversion to Customer Master
router.post('/leads/:id/convert', crmController.convertLead);

// Opportunities CRUD
router.get('/opportunities', crmController.getOpportunities);
router.post('/opportunities', crmController.createOpportunity);
router.put('/opportunities/:id', crmController.updateOpportunity);
router.delete('/opportunities/:id', crmController.deleteOpportunity);

// Follow-Ups CRUD
router.get('/followups', crmController.getFollowUps);
router.post('/followups', crmController.createFollowUp);
router.put('/followups/:id', crmController.updateFollowUp);
router.delete('/followups/:id', crmController.deleteFollowUp);

// Customer Reviews & WhatsApp Invites
router.get('/reviews', crmController.getReviewsList);
router.post('/reviews/send', crmController.sendReviewInvite);

module.exports = router;
