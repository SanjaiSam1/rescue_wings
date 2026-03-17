const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, getConversations } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/send', protect, sendMessage);
router.get('/messages/:userId', protect, getMessages);
router.get('/conversations', protect, getConversations);

module.exports = router;
