const express = require('express');
const router = express.Router();
const { createAlert, getAllAlerts, deactivateAlert } = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create', protect, authorize('admin'), createAlert);
router.get('/all', getAllAlerts);
router.put('/:id/deactivate', protect, authorize('admin'), deactivateAlert);

module.exports = router;
