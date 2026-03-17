const express = require('express');
const router = express.Router();
const { createAlert, getAlerts, deactivateAlert } = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create', protect, authorize('admin'), createAlert);
router.get('/all', getAlerts);
router.put('/deactivate/:id', protect, authorize('admin'), deactivateAlert);

module.exports = router;
