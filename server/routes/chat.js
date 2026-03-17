const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, getConversations, getContacts } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/send', protect, upload.single('image'), sendMessage);
router.get('/messages/:userId', protect, getMessages);
router.get('/conversations', protect, getConversations);
router.get('/contacts', protect, getContacts);

module.exports = router;
