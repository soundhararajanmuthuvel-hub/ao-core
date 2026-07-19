const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getSales,
  getSale,
  createSale,
  deleteSale,
  getOutstandingInvoices,
  getWhatsAppReminder,
  recordPayment,
  getPayments,
  repairInvoiceStatus,
  updateSale,
  updatePayment,
  deletePayment,
} = require('../controllers/salesController');

router.use(auth);
router.get('/', getSales);
router.post('/reconcile', repairInvoiceStatus);
router.get('/outstanding', getOutstandingInvoices);
router.get('/payments', getPayments);
router.post('/payment', recordPayment);
router.put('/payment/:id', updatePayment);
router.delete('/payment/:id', deletePayment);
router.get('/:id', getSale);
router.get('/:id/whatsapp-reminder', getWhatsAppReminder);
router.post('/', createSale);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
