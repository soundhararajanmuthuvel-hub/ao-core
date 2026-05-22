const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'AO Core test route is working',
  });
});

router.get('/db', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    database:
      mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

module.exports = router;
