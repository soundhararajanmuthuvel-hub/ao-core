const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');

// Search Orders / Invoices for Return creation
router.get('/order-search', returnsController.orderSearch);

// Barcode & QR Code lookup
router.post('/scan-lookup', returnsController.scanLookup);

// Returns CRUD & Simple Workflow
router.post('/', returnsController.createReturnRequest);
router.get('/', returnsController.getReturns);
router.get('/analytics/dashboard', returnsController.getDashboardMetrics);
router.get('/ai/insights', returnsController.getAiInsights);
router.get('/near-expiry/scan', returnsController.getNearExpiryScan);
router.get('/fast-selling-shops/recommend', returnsController.recommendFastSellingShops);
router.post('/fast-selling-shops/recommend', returnsController.recommendFastSellingShops);
router.get('/repack-orders', returnsController.getRepackWorkOrders);

router.put('/repack-orders/:id/complete', returnsController.completeRepackWorkOrder);
router.get('/ncrs', returnsController.getNcrs);
router.get('/batch-recalls', returnsController.getBatchRecalls);

router.get('/:id', returnsController.getReturnById);
router.put('/:id/approve', returnsController.approveReturn);
router.put('/:id/receive', returnsController.receiveReturn);
router.put('/:id/process-refund', returnsController.processRefund);
router.put('/:id/process-replacement', returnsController.processReplacement);
router.put('/:id/cancel', returnsController.cancelReturn);
router.post('/:id/qc-inspect', returnsController.qcInspect);
router.put('/:id/close', returnsController.closeReturn);

module.exports = router;
