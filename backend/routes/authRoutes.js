const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { login, me } = require('../controllers/authController');

router.post('/login', login);
router.get('/me', auth, me);

router.get('/debug', async (req, res) => {
  try {
    const User = require('../models/User');
    const userCount = await User.count();
    const users = await User.findAll({ attributes: ['id', 'email', 'name', 'role'] });
    res.json({
      success: true,
      userCount,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
