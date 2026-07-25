const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getCustomers,
  getCustomer,
  getCustomerSales,
  getCustomer360Profile,
  createCustomer,

  updateCustomer,
  deleteCustomer,
  getCustomerPayments,
  archiveCustomer,
  restoreCustomer,
  getCustomerDependencies,
  getCrmNotes,
  createCrmNote,
  getCrmFollowUps,
  createCrmFollowUp,
  updateCrmFollowUp,
  getReminderHistory,
  createReminderHistory,
} = require('../controllers/customerController');

router.use(auth);
router.get('/', getCustomers);
router.get('/:id/profile', getCustomer360Profile);
router.get('/:id/sales', getCustomerSales);

router.get('/:id/payments', getCustomerPayments);
router.get('/:id/dependencies', getCustomerDependencies);
router.put('/:id/archive', archiveCustomer);
router.put('/:id/restore', restoreCustomer);

// CRM Sub-resources
router.get('/:id/notes', getCrmNotes);
router.post('/:id/notes', createCrmNote);
router.get('/:id/followups', getCrmFollowUps);
router.post('/:id/followups', createCrmFollowUp);
router.put('/:id/followups/:followUpId', updateCrmFollowUp);
router.get('/:id/reminders', getReminderHistory);
router.post('/:id/reminders', createReminderHistory);

router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
