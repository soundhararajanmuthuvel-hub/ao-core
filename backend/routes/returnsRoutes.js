const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');

// Barcode & QR Code lookup
router.post('/scan-lookup', returnsController.scanLookup);

// Returns CRUD & Workflow
router.post('/', returnsController.createReturnRequest);
router.get('/', returnsController.getReturns);
router.get('/analytics/dashboard', returnsController.getDashboardMetrics);
router.get('/ai/insights', returnsController.getAiInsights);
router.get('/near-expiry/scan', returnsController.getNearExpiryScan);
router.post('/fast-selling-shops/recommend', returnsController.recommendFastSellingShops);
router.get('/repack-orders', returnsController.getRepackWorkOrders);
router.put('/repack-orders/:id/complete', returnsController.completeRepackWorkOrder);
router.get('/ncrs', returnsController.getNcrs);
router.get('/batch-recalls', returnsController.getBatchRecalls);

router.get('/:id', returnsController.getReturnById);
router.put('/:id/approve', returnsController.approveReturn);
router.post('/:id/qc-inspect', returnsController.qcInspect);
router.put('/:id/close', returnsController.closeReturn);

module.exports = router;
