// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, updateLocation } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/errorHandler');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/location', protect, updateLocation);

module.exports = router;
