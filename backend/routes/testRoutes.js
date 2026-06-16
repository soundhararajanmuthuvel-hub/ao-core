const express = require('express');
const { sequelize } = require('../config/db');

const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'AO Core test route is working',
  });
});

router.get('/db', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      success: true,
      status: 'OK',
      database: 'Connected',
    });
  } catch (err) {
    res.json({
      success: false,
      status: 'Error',
      database: 'Disconnected',
      error: err.message,
    });
  }
});

module.exports = router;
