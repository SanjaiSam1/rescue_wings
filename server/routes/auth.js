const express = require('express');
const router = express.Router();
const {
	register,
	login,
	verifyEmailOtp,
	forgotPassword,
	resetPassword,
	refreshToken,
	logout,
	getProfile,
	updateProfile,
	getUsersSummary,
	getUserActivityLog,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', upload.single('proofDocument'), register);
router.post('/login', login);
router.post('/verify-otp', verifyEmailOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', protect, logout);
router.post('/refresh', protect, refreshToken);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/users-summary', protect, authorize('admin'), getUsersSummary);
router.get('/activity-log', protect, authorize('admin'), getUserActivityLog);

module.exports = router;
