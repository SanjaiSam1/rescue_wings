const express = require('express');
const router = express.Router();
const {
  createRequest, getAllRequests, getRequest,
  updateRequest, deleteRequest, getNearbyRequests,
  cancelOwnRequest, getCitizenHistory, rateVolunteer, rejectAssignedMission,
  assignVolunteerByAdmin
} = require('../controllers/rescueController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/create', protect, upload.array('images', 5), createRequest);
router.get('/all', protect, getAllRequests);
router.get('/history/me', protect, authorize('citizen'), getCitizenHistory);
router.get('/nearby', protect, getNearbyRequests);
router.put('/cancel/:id', protect, authorize('citizen'), cancelOwnRequest);
router.put('/rate/:id', protect, authorize('citizen'), rateVolunteer);
router.put('/reject/:id', protect, authorize('volunteer'), rejectAssignedMission);
router.put('/assign/:id', protect, authorize('admin'), assignVolunteerByAdmin);
router.get('/:id', protect, getRequest);
router.put('/update/:id', protect, authorize('volunteer', 'admin'), updateRequest);
router.delete('/:id', protect, deleteRequest);

module.exports = router;
