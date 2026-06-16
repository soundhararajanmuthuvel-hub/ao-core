const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  listOrders,
  getOrder,
  markPacked,
  markDispatched,
  markDelivered,
  getOrderDashboard
} = require('../controllers/orderController');

router.use(auth);
router.post('/', createOrder);
router.get('/', listOrders);
router.get('/dashboard', getOrderDashboard);
router.get('/:id', getOrder);
router.post('/:id/mark-packed', markPacked);
router.post('/:id/mark-dispatched', markDispatched);
router.post('/:id/mark-delivered', markDelivered);

module.exports = router;
