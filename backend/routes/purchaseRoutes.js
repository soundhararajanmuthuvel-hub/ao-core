const express = require('express');

const router = express.Router();

/* ==============================
   TEST ROUTE
============================== */
router.get('/test/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: '✅ Purchase Route Working',
  });
});

module.exports = router;