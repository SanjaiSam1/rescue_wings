// routes/rescueRoutes.js
const express = require('express');
const router = express.Router();
const {
  createRequest, getAllRequests, getRequest, getMyRequests,
  updateRequest, deleteRequest, getNearbyRequests, getStats
} = require('../controllers/rescueController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create', protect, createRequest);
router.get('/all', protect, authorize('admin', 'volunteer'), getAllRequests);
router.get('/my-requests', protect, getMyRequests);
router.get('/nearby', protect, authorize('volunteer', 'admin'), getNearbyRequests);
router.get('/stats', protect, authorize('admin'), getStats);
router.get('/:id', protect, getRequest);
router.put('/update/:id', protect, authorize('admin', 'volunteer'), updateRequest);
router.delete('/:id', protect, authorize('admin'), deleteRequest);

module.exports = router;


// routes/volunteerRoutes.js
const express2 = require('express');
const router2 = express2.Router();
const { applyAsVolunteer, getVolunteers, approveVolunteer, updateAvailability } = require('../controllers/volunteerController');
const { protect: protect2, authorize: authorize2 } = require('../middleware/auth');

router2.post('/apply', protect2, applyAsVolunteer);
router2.get('/list', protect2, authorize2('admin'), getVolunteers);
router2.put('/approve/:id', protect2, authorize2('admin'), approveVolunteer);
router2.put('/availability', protect2, authorize2('volunteer'), updateAvailability);

module.exports = router2;


// routes/alertRoutes.js
const express3 = require('express');
const router3 = express3.Router();
const { createAlert, getAlerts, deactivateAlert } = require('../controllers/alertController');
const { protect: protect3, authorize: authorize3 } = require('../middleware/auth');

router3.post('/create', protect3, authorize3('admin'), createAlert);
router3.get('/all', getAlerts); // Public - anyone can read alerts
router3.put('/deactivate/:id', protect3, authorize3('admin'), deactivateAlert);

module.exports = router3;


// routes/chatRoutes.js
const express4 = require('express');
const router4 = express4.Router();
const { sendMessage, getMessages, getConversations } = require('../controllers/alertController');
const { protect: protect4 } = require('../middleware/auth');

// Note: chatController functions imported separately below
module.exports = router4;
