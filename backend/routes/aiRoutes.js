const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAIInsights, chatAI } = require('../controllers/aiController');

router.get('/insights', auth, getAIInsights);
router.post('/chat', auth, chatAI);

module.exports = router;
