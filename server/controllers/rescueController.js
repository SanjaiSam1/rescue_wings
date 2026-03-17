/**
 * Rescue Request Controller
 */
const RescueRequest = require('../models/RescueRequest');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');
const { logActivity } = require('../utils/activityLogger');
const { createNotification, createNotificationsForUsers } = require('../utils/notificationService');

const URGENCY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const URGENCY_KEYWORDS = {
  critical: ['trapped', 'collapsed', 'bleeding', 'unconscious', 'drowning', 'fire spreading', 'building collapse', 'severe injury'],
  high: ['injured', 'stuck', 'urgent', 'flooding', 'smoke', 'landslide', 'unable to move'],
  medium: ['need help', 'stranded', 'water level rising', 'power outage'],
};

const classifyUrgencyFromDescription = (description = '') => {
  const text = String(description).toLowerCase();

  if (URGENCY_KEYWORDS.critical.some((k) => text.includes(k))) return 'critical';
  if (URGENCY_KEYWORDS.high.some((k) => text.includes(k))) return 'high';
  if (URGENCY_KEYWORDS.medium.some((k) => text.includes(k))) return 'medium';
  return 'low';
};

const STATUS_NOTIFICATION_TEXT = {
  pending: 'Your request is pending and waiting for assignment.',
  accepted: 'A volunteer has accepted your SOS request.',
  'in-progress': 'Your rescue mission is now in progress.',
  rescued: 'Your rescue mission has been marked as completed.',
  cancelled: 'Your SOS request has been cancelled.',
};

// POST /api/rescue/create
exports.createRequest = async (req, res) => {
  try {
    const { location: rawLocation, disasterType, description, urgencyLevel, numberOfPeople } = req.body;
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const duplicateActive = await RescueRequest.findOne({
      userId: req.user._id,
      status: { $in: ['pending', 'accepted', 'in-progress'] },
    }).select('_id status createdAt');

    if (duplicateActive) {
      return res.status(409).json({
        error: 'You already have an active SOS request. Resolve or cancel it before creating another one.',
        activeRequestId: duplicateActive._id,
      });
    }

    // Multer/form-data sends nested fields as strings, so parse location safely.
    let parsedLocation = rawLocation;
    if (typeof rawLocation === 'string') {
      try {
        parsedLocation = JSON.parse(rawLocation);
      } catch {
        parsedLocation = null;
      }
    }

    const hasValidCoordinates =
      parsedLocation &&
      Array.isArray(parsedLocation.coordinates) &&
      parsedLocation.coordinates.length === 2 &&
      Number.isFinite(Number(parsedLocation.coordinates[0])) &&
      Number.isFinite(Number(parsedLocation.coordinates[1]));

    if (!hasValidCoordinates) {
      return res.status(400).json({ error: 'Valid GPS location is required. Please share your location and try again.' });
    }

    const location = {
      type: 'Point',
      coordinates: [
        Number(parsedLocation.coordinates[0]),
        Number(parsedLocation.coordinates[1]),
      ],
      address: parsedLocation.address || '',
    };

    const autoUrgency = classifyUrgencyFromDescription(description);
    const requestedUrgency = URGENCY_RANK[urgencyLevel] ? urgencyLevel : 'low';
    const effectiveUrgency = URGENCY_RANK[autoUrgency] > URGENCY_RANK[requestedUrgency]
      ? autoUrgency
      : requestedUrgency;

    const request = await RescueRequest.create({
      userId: req.user._id,
      location,
      disasterType,
      description,
      urgencyLevel: effectiveUrgency,
      numberOfPeople,
      images,
      escalationNotified: false,
      statusHistory: [{
        status: 'pending',
        updatedBy: req.user._id,
        note: `Request created (urgency auto-classified as ${autoUrgency})`,
      }],
    });

    await request.populate('userId', 'name phone email');

    // Emit SOS to admins and volunteers instantly.
    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('new_rescue_request', request);

    const approvedVolunteers = await Volunteer.find({ verificationStatus: 'approved' }).select('userId').lean();
    const approvedVolunteerUserIds = approvedVolunteers.map((v) => String(v.userId || '')).filter(Boolean);
    const activeVolunteerUsers = await User.find({
      _id: { $in: approvedVolunteerUserIds },
      role: 'volunteer',
      isActive: true,
    }).select('_id').lean();
    const volunteerUserIds = activeVolunteerUsers.map((u) => u._id).filter(Boolean);
    const locationText = request.location?.address || `${request.location?.coordinates?.[1]}, ${request.location?.coordinates?.[0]}`;
    const sosMessage = `🚨 SOS Raised by ${request.userId?.name || 'Citizen'} - ${request.description || locationText}`;
    await createNotificationsForUsers(io, {
      userIds: volunteerUserIds,
      role: 'volunteer',
      type: 'sos',
      message: sosMessage,
      linkedId: request._id,
      data: {
        requestId: String(request._id),
        citizenName: request.userId?.name || 'Citizen',
        disasterType: request.disasterType,
        location: request.location,
      },
    });

    res.status(201).json({ message: 'Rescue request created', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/rescue/all
exports.getAllRequests = async (req, res) => {
  try {
    const {
      status,
      disasterType,
      urgencyLevel,
      scope = 'all',
      page = 1,
      limit = 20,
      longitude,
      latitude,
      maxDistance,
    } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (disasterType) filter.disasterType = disasterType;
    if (urgencyLevel) filter.urgencyLevel = urgencyLevel;

    // Citizens can only see their own requests
    if (req.user.role === 'citizen') {
      filter.userId = req.user._id;
    }

    // Volunteers can switch between assigned missions and open missions.
    if (req.user.role === 'volunteer') {
      if (scope === 'mine') {
        filter.assignedVolunteer = req.user._id;
      } else if (scope === 'open') {
        filter.status = 'pending';
        filter.assignedVolunteer = null;
      }
    }

    const hasGeoFilter =
      Number.isFinite(Number(longitude)) &&
      Number.isFinite(Number(latitude));

    if (hasGeoFilter) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)],
          },
          $maxDistance: Number(maxDistance) || 50000,
        },
      };
    }

    const requests = await RescueRequest.find(filter)
      .populate('userId', 'name phone email')
      .populate('assignedVolunteer', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RescueRequest.countDocuments(filter);

    res.json({ requests, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/rescue/:id
exports.getRequest = async (req, res) => {
  try {
    const request = await RescueRequest.findById(req.params.id)
      .populate('userId', 'name phone email location')
      .populate('assignedVolunteer', 'name phone email')
      .populate('statusHistory.updatedBy', 'name role');

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (req.user.role === 'citizen' && request.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this request' });
    }

    if (
      req.user.role === 'volunteer' &&
      request.assignedVolunteer &&
      request.assignedVolunteer._id.toString() !== req.user._id.toString() &&
      request.status !== 'pending'
    ) {
      return res.status(403).json({ error: 'This mission is assigned to another volunteer' });
    }

    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rescue/update/:id
exports.updateRequest = async (req, res) => {
  try {
    const { status, note } = req.body;
    const request = await RescueRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (req.user.role === 'volunteer') {
      const volunteerProfile = await Volunteer.findOne({ userId: req.user._id });
      if (!volunteerProfile || volunteerProfile.verificationStatus !== 'approved') {
        return res.status(403).json({ error: 'Only approved volunteers can manage missions' });
      }

      const validVolunteerStatuses = ['accepted', 'in-progress', 'rescued'];
      if (!validVolunteerStatuses.includes(status)) {
        return res.status(403).json({ error: 'Volunteers can only set accepted, in-progress or rescued' });
      }

      if (status === 'accepted') {
        if (request.status !== 'pending') {
          return res.status(400).json({ error: 'Only pending requests can be accepted' });
        }
        if (request.assignedVolunteer && request.assignedVolunteer.toString() !== req.user._id.toString()) {
          return res.status(409).json({ error: 'This request is already assigned' });
        }
        request.assignedVolunteer = req.user._id;
        request.acceptedAt = request.acceptedAt || new Date();
      } else {
        if (!request.assignedVolunteer || request.assignedVolunteer.toString() !== req.user._id.toString()) {
          return res.status(403).json({ error: 'Only assigned volunteer can update this request' });
        }
      }
    }

    if (req.user.role === 'admin') {
      const validAdminStatuses = ['pending', 'accepted', 'in-progress', 'rescued', 'cancelled', 'failed'];
      if (!validAdminStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status for admin update' });
      }
    }

    if (status === 'accepted') {
      request.acceptedAt = request.acceptedAt || new Date();
      request.escalationNotified = false;
      request.escalationNotifiedAt = null;
    }

    if (status === 'rescued' || status === 'failed' || status === 'cancelled') {
      request.resolvedAt = new Date();

      if (request.assignedVolunteer) {
        await Volunteer.findOneAndUpdate(
          { userId: request.assignedVolunteer },
          {
            $inc: { completedMissions: 1 },
            $set: { availability: 'available' },
          }
        );
      }
    }

    request.status = status;
    request.statusHistory.push({
      status,
      updatedBy: req.user._id,
      note: note || `Status updated to ${status}`,
    });

    await request.save();
    await request.populate('userId', 'name phone email');
    await request.populate('assignedVolunteer', 'name phone email');

    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', request);
    // Notify the specific citizen directly.
    io.to(`user_${request.userId._id}`).emit('your_request_updated', request);
    if (STATUS_NOTIFICATION_TEXT[status]) {
      io.to(`user_${request.userId._id}`).emit('request_status_notification', {
        requestId: request._id,
        status,
        message: STATUS_NOTIFICATION_TEXT[status],
        timestamp: new Date(),
      });

      await createNotification(io, {
        userId: request.userId._id,
        role: 'citizen',
        type: 'sos-status',
        message: STATUS_NOTIFICATION_TEXT[status],
        linkedId: request._id,
        data: {
          requestId: String(request._id),
          status,
        },
      });
    }

    if (request.assignedVolunteer?._id) {
      io.to(`user_${request.assignedVolunteer._id}`).emit('assigned_mission_updated', request);
    }

    await logActivity({
      user: req.user,
      action: 'update_request_status',
      entityType: 'rescue_request',
      entityId: request._id,
      details: `status=${status}; note=${note || ''}`,
      req,
    });

    res.json({ message: 'Request updated', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rescue/reject/:id
exports.rejectAssignedMission = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const request = await RescueRequest.findById(req.params.id)
      .populate('userId', 'name phone email')
      .populate('assignedVolunteer', 'name phone email');

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (!request.assignedVolunteer || request.assignedVolunteer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only currently assigned volunteer can reject this mission' });
    }

    if (!['accepted', 'in-progress'].includes(request.status)) {
      return res.status(400).json({ error: 'Only active missions can be rejected' });
    }

    const rejectionNote = `Mission rejected by volunteer: ${String(reason).trim()}`;

    request.volunteerRejections.push({
      volunteerId: req.user._id,
      reason: String(reason).trim(),
    });
    request.status = 'pending';
    request.assignedVolunteer = null;
    request.assignedByAdmin = null;
    request.assignedAt = null;
    request.acceptedAt = null;
    request.statusHistory.push({
      status: 'pending',
      updatedBy: req.user._id,
      note: rejectionNote,
    });
    await request.save();
    await request.populate('assignedVolunteer', 'name phone email');

    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', request);
    io.to('admin').to('role_admin').emit('mission_rejected', {
      requestId: request._id,
      volunteerId: req.user._id,
      reason: String(reason).trim(),
      rejectedAt: new Date(),
    });
    io.to(`user_${request.userId._id}`).emit('your_request_updated', request);
    io.to(`user_${request.userId._id}`).emit('request_status_notification', {
      requestId: request._id,
      status: 'pending',
      message: 'Your mission was reassigned and is now pending again.',
      timestamp: new Date(),
    });

    await createNotification(io, {
      userId: request.userId._id,
      role: 'citizen',
      type: 'sos-status',
      message: 'Your mission was reassigned and is now pending again.',
      linkedId: request._id,
      data: {
        requestId: String(request._id),
        status: 'pending',
      },
    });

    await logActivity({
      user: req.user,
      action: 'reject_assigned_mission',
      entityType: 'rescue_request',
      entityId: request._id,
      details: String(reason).trim(),
      req,
    });

    res.json({ message: 'Mission rejected and returned to open queue', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rescue/cancel/:id
exports.cancelOwnRequest = async (req, res) => {
  try {
    const { note } = req.body;
    const request = await RescueRequest.findById(req.params.id)
      .populate('userId', 'name phone email')
      .populate('assignedVolunteer', 'name phone email');

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only request owner can cancel this request' });
    }

    if (['rescued', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ error: 'This request is already closed' });
    }

    request.status = 'cancelled';
    request.resolvedAt = new Date();
    request.statusHistory.push({
      status: 'cancelled',
      updatedBy: req.user._id,
      note: note || 'Citizen cancelled request',
    });

    await request.save();

    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', request);
    io.to(`user_${request.userId._id}`).emit('your_request_updated', request);
    io.to(`user_${request.userId._id}`).emit('request_status_notification', {
      requestId: request._id,
      status: 'cancelled',
      message: STATUS_NOTIFICATION_TEXT.cancelled,
      timestamp: new Date(),
    });

    await createNotification(io, {
      userId: request.userId._id,
      role: 'citizen',
      type: 'sos-status',
      message: STATUS_NOTIFICATION_TEXT.cancelled,
      linkedId: request._id,
      data: {
        requestId: String(request._id),
        status: 'cancelled',
      },
    });

    if (request.assignedVolunteer?._id) {
      io.to(`user_${request.assignedVolunteer._id}`).emit('assigned_mission_updated', request);
    }

    await logActivity({
      user: req.user,
      action: 'cancel_own_request',
      entityType: 'rescue_request',
      entityId: request._id,
      details: note || '',
      req,
    });

    res.json({ message: 'Request cancelled', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rescue/assign/:id
exports.assignVolunteerByAdmin = async (req, res) => {
  try {
    const { volunteerId, note, override = false } = req.body;

    if (!volunteerId) {
      return res.status(400).json({ error: 'volunteerId is required' });
    }

    const [request, volunteerProfile] = await Promise.all([
      RescueRequest.findById(req.params.id)
        .populate('userId', 'name phone email')
        .populate('assignedVolunteer', 'name phone email'),
      Volunteer.findOne({ userId: volunteerId }).populate('userId', 'name phone email role'),
    ]);

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!volunteerProfile || volunteerProfile.verificationStatus !== 'approved') {
      return res.status(400).json({ error: 'Selected volunteer is not approved' });
    }

    const canOverride = Boolean(override);
    const isAlreadyAssigned = Boolean(request.assignedVolunteer);

    if (isAlreadyAssigned && !canOverride) {
      return res.status(400).json({ error: 'Request already assigned. Use override=true to reassign.' });
    }

    if (!['pending', 'accepted', 'in-progress'].includes(request.status)) {
      return res.status(400).json({ error: 'Only pending/active requests can be assigned' });
    }

    const previousVolunteerId = request.assignedVolunteer?._id;

    request.assignedVolunteer = volunteerProfile.userId._id;
    request.assignedByAdmin = req.user._id;
    request.assignedAt = new Date();
    request.acceptedAt = request.acceptedAt || new Date();
    request.status = request.status === 'pending' ? 'accepted' : request.status;
    request.escalationNotified = false;
    request.escalationNotifiedAt = null;
    request.statusHistory.push({
      status: request.status,
      updatedBy: req.user._id,
      note: note || (canOverride ? 'Admin reassigned mission' : 'Admin assigned volunteer'),
    });
    await request.save();
    await request.populate('assignedVolunteer', 'name phone email');

    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', request);
    io.to(`user_${request.userId._id}`).emit('your_request_updated', request);
    io.to(`user_${request.userId._id}`).emit('request_status_notification', {
      requestId: request._id,
      status: request.status,
      message: 'Admin assigned a volunteer to your SOS request.',
      timestamp: new Date(),
    });
    io.to(`user_${volunteerProfile.userId._id}`).emit('assigned_mission_updated', request);

    if (previousVolunteerId && String(previousVolunteerId) !== String(volunteerProfile.userId._id)) {
      io.to(`user_${previousVolunteerId}`).emit('assigned_mission_updated', {
        _id: request._id,
        status: 'pending',
        note: 'Mission reassigned by admin',
      });
    }

    await logActivity({
      user: req.user,
      action: canOverride ? 'admin_override_mission' : 'admin_assign_volunteer',
      entityType: 'rescue_request',
      entityId: request._id,
      details: `volunteerId=${volunteerId}; note=${note || ''}`,
      req,
    });

    res.json({ message: canOverride ? 'Mission reassigned' : 'Volunteer assigned', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/rescue/history/me
exports.getCitizenHistory = async (req, res) => {
  try {
    const requests = await RescueRequest.find({
      userId: req.user._id,
      status: { $in: ['rescued', 'cancelled'] },
    })
      .populate('assignedVolunteer', 'name')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rescue/rate/:id
exports.rateVolunteer = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const numericRating = Number(rating);

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const request = await RescueRequest.findById(req.params.id)
      .populate('assignedVolunteer', '_id name');

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only request owner can submit rating' });
    }

    if (request.status !== 'rescued') {
      return res.status(400).json({ error: 'Rating can only be submitted after completion' });
    }

    if (!request.assignedVolunteer?._id) {
      return res.status(400).json({ error: 'No volunteer assigned for this request' });
    }

    if (request.citizenFeedback?.rating) {
      return res.status(400).json({ error: 'Rating already submitted for this request' });
    }

    request.citizenFeedback = {
      rating: numericRating,
      feedback: feedback ? String(feedback).trim() : '',
      ratedAt: new Date(),
    };
    await request.save();

    const volunteerProfile = await Volunteer.findOne({ userId: request.assignedVolunteer._id });
    if (volunteerProfile) {
      const previousSum = volunteerProfile.rating * volunteerProfile.ratingCount;
      const nextCount = volunteerProfile.ratingCount + 1;
      volunteerProfile.ratingCount = nextCount;
      volunteerProfile.rating = Number(((previousSum + numericRating) / nextCount).toFixed(2));
      await volunteerProfile.save();
    }

    const io = req.app.get('io');
    io.to(`user_${request.assignedVolunteer._id}`).emit('volunteer_rating_received', {
      requestId: request._id,
      rating: numericRating,
      feedback: request.citizenFeedback.feedback,
      from: req.user._id,
      timestamp: request.citizenFeedback.ratedAt,
    });

    res.json({ message: 'Volunteer rated successfully', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/rescue/:id
exports.deleteRequest = async (req, res) => {
  try {
    const request = await RescueRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Only the owner or admin can delete
    if (request.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await request.deleteOne();
    res.json({ message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/rescue/nearby - Get requests near a location
exports.getNearbyRequests = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 50000 } = req.query; // 50km default

    const requests = await RescueRequest.find({
      status: { $in: ['pending', 'accepted', 'in-progress'] },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: parseInt(maxDistance),
        },
      },
    }).populate('userId', 'name phone');

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
