const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getNotifications, 
  markRead, 
  markAllRead,
  deleteNotification,
  clearAllNotifications
} = require('../controllers/notificationController');

router.use(auth);
router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/', clearAllNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
