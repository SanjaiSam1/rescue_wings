const express = require('express');
const router = express.Router();
const { applyAsVolunteer, getVolunteers, approveVolunteer, updateAvailability } = require('../controllers/volunteerController');
const { protect, authorize } = require('../middleware/auth');

router.post('/apply', protect, applyAsVolunteer);
router.get('/list', protect, authorize('admin'), getVolunteers);
router.put('/approve/:id', protect, authorize('admin'), approveVolunteer);
router.put('/availability', protect, authorize('volunteer'), updateAvailability);

module.exports = router;
