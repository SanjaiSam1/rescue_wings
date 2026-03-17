const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAdvancedAnalytics,
  getVolunteerPerformanceReport,
  getAvailableVolunteers,
  getDisasterHeatmap,
  getEscalatedRequests,
  exportOperationsReport,
  getPendingVolunteers,
  getAdminActivityLog,
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/analytics', getAdvancedAnalytics);
router.get('/volunteer-performance', getVolunteerPerformanceReport);
router.get('/available-volunteers', getAvailableVolunteers);
router.get('/heatmap', getDisasterHeatmap);
router.get('/escalations', getEscalatedRequests);
router.get('/pending-volunteers', getPendingVolunteers);
router.get('/activity-log', getAdminActivityLog);
router.get('/export', exportOperationsReport);

module.exports = router;
