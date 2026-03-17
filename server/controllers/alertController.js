/**
 * Alert Controller - Emergency broadcasts
 */
const Alert = require('../models/Alert');
const { logActivity } = require('../utils/activityLogger');

// POST /api/alerts/create
exports.createAlert = async (req, res) => {
  try {
    const { title, message, type, severity, targetRole = 'all', location, affectedAreas, expiresAt } = req.body;

    const alert = await Alert.create({
      title, message, type, severity, targetRole, location, affectedAreas, expiresAt,
      createdBy: req.user._id,
    });

    await alert.populate('createdBy', 'name');

    // Broadcast to target role room(s)
    const io = req.app.get('io');
    if (targetRole === 'citizen') {
      io.to('citizen').to('role_citizen').emit('emergency_alert', alert);
    } else if (targetRole === 'volunteer') {
      io.to('volunteer').to('role_volunteer').emit('emergency_alert', alert);
    } else {
      io.emit('emergency_alert', alert);
    }

    await logActivity({
      user: req.user,
      action: 'admin_broadcast_alert',
      entityType: 'alert',
      entityId: alert._id,
      details: `Broadcast target=${targetRole}, severity=${severity}`,
      req,
    });

    res.status(201).json({ message: 'Alert broadcast', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alerts/all
exports.getAllAlerts = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === 'true') filter.isActive = true;

    const alerts = await Alert.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/alerts/:id/deactivate
exports.deactivateAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deactivated', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
