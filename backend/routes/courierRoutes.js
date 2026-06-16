const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getCouriers,
  createCourier,
  updateCourier,
  deleteCourier,
} = require('../controllers/courierController');

// All courier routes require authentication
router.use(auth);

router.get('/', getCouriers);
router.post('/', createCourier);
router.put('/:id', updateCourier);
router.delete('/:id', deleteCourier);

module.exports = router;
