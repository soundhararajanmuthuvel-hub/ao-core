const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSales, getSale, createSale, deleteSale } = require('../controllers/salesController');

router.use(auth);
router.get('/', getSales);
router.get('/:id', getSale);
router.post('/', createSale);
router.delete('/:id', deleteSale);

module.exports = router;
