const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getCustomers,
  getCustomer,
  getCustomerSales,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

router.use(auth);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.get('/:id/sales', getCustomerSales);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
