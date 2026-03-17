const express = require('express');
const router = express.Router();
const {
  applyAsVolunteer,
  getVolunteers,
  approveVolunteer,
  updateAvailability,
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
  getVolunteerMissionHistory,
  getVolunteerStats,
} = require('../controllers/volunteerController');
const { protect, authorize } = require('../middleware/auth');

router.post('/apply', protect, applyAsVolunteer);
router.get('/list', protect, getVolunteers);
router.get('/me', protect, authorize('volunteer'), getMyVolunteerProfile);
router.put('/profile', protect, authorize('volunteer'), updateMyVolunteerProfile);
router.get('/history', protect, authorize('volunteer'), getVolunteerMissionHistory);
router.get('/stats', protect, authorize('volunteer'), getVolunteerStats);
router.put('/approve/:id', protect, authorize('admin'), approveVolunteer);
router.put('/availability', protect, authorize('volunteer'), updateAvailability);

module.exports = router;
