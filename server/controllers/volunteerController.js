/**
 * Volunteer Controller
 */
const Volunteer = require('../models/Volunteer');
const User = require('../models/User');
const RescueRequest = require('../models/RescueRequest');
const { logActivity } = require('../utils/activityLogger');
const { sendMail } = require('../utils/mailer');

const REJECTION_MESSAGE = 'Your application was not approved at this time. Please contact support for more information.';

const sendVolunteerDecisionEmail = async ({ email, name, action }) => {
  const appUrl = process.env.APP_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  if (action === 'approve') {
    const subject = 'Rescue Wings: Volunteer Application Approved';
    const text = `Congratulations ${name}! Your volunteer account has been approved. You can now log in using your registered credentials at ${appUrl}.`;
    const html = `<p>Congratulations ${name}!</p><p>Your volunteer account has been approved.</p><p>You can now log in using your registered credentials at <a href="${appUrl}">${appUrl}</a>.</p>`;
    await sendMail({ to: email, subject, text, html });
    return;
  }

  const subject = 'Rescue Wings: Volunteer Application Update';
  const text = `Hello ${name}, ${REJECTION_MESSAGE}`;
  const html = `<p>Hello ${name},</p><p>${REJECTION_MESSAGE}</p>`;
  await sendMail({ to: email, subject, text, html });
};

// POST /api/volunteer/apply
exports.applyAsVolunteer = async (req, res) => {
  try {
    const existing = await Volunteer.findOne({ userId: req.user._id });
    if (existing) return res.status(400).json({ error: 'Already applied as volunteer' });

    const { skills, organization, experience, certifications, emergencyContact } = req.body;
    const volunteer = await Volunteer.create({
      userId: req.user._id,
      skills,
      organization,
      experience,
      certifications,
      emergencyContact,
    });

    // Update user role to volunteer
    await User.findByIdAndUpdate(req.user._id, { role: 'volunteer' });

    res.status(201).json({ message: 'Volunteer application submitted. Awaiting approval.', volunteer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/volunteer/list
exports.getVolunteers = async (req, res) => {
  try {
    const { status, availability } = req.query;
    const filter = {};
    if (status) filter.verificationStatus = status;
    if (availability) filter.availability = availability;

    const volunteers = await Volunteer.find(filter).populate('userId', 'name email phone location');
    res.json({ volunteers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/volunteer/approve/:id
exports.approveVolunteer = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const volunteer = await Volunteer.findById(req.params.id).populate('userId', 'name email');
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    volunteer.verificationStatus = action === 'approve' ? 'approved' : 'rejected';
    volunteer.verifiedBy = req.user._id;
    volunteer.verifiedAt = new Date();
    volunteer.verificationReason = action === 'reject' ? REJECTION_MESSAGE : '';
    await volunteer.save();

    const userName = volunteer.userId?.name || 'Volunteer';
    const userEmail = volunteer.userId?.email;
    if (userEmail) {
      try {
        await sendVolunteerDecisionEmail({
          email: userEmail,
          name: userName,
          action,
        });
      } catch {
        // Email delivery failures should not block approval workflow.
      }
    }

    const io = req.app.get('io');
    io.to(`user_${volunteer.userId}`).emit('volunteer_status_updated', {
      status: volunteer.verificationStatus,
    });
    io.emit('volunteer_status_changed', {
      volunteerId: volunteer._id,
      userId: volunteer.userId,
      status: volunteer.verificationStatus,
      reason: volunteer.verificationReason,
    });

    await logActivity({
      user: req.user,
      action: action === 'approve' ? 'admin_approve_volunteer' : 'admin_reject_volunteer',
      entityType: 'volunteer',
      entityId: volunteer._id,
      details: action === 'reject' ? REJECTION_MESSAGE : 'Volunteer approved',
      req,
    });

    res.json({ message: `Volunteer ${action}d`, volunteer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/volunteer/availability
exports.updateAvailability = async (req, res) => {
  try {
    const { availability } = req.body;
    if (!['available', 'busy', 'offline'].includes(availability)) {
      return res.status(400).json({ error: 'Availability must be available, busy, or offline' });
    }

    const volunteer = await Volunteer.findOneAndUpdate(
      { userId: req.user._id },
      { availability },
      { new: true }
    );
    if (!volunteer) return res.status(404).json({ error: 'Volunteer profile not found' });

    const io = req.app.get('io');
    io.to('admin').to('role_admin').emit('volunteer_availability_changed', {
      userId: req.user._id,
      availability,
      updatedAt: new Date(),
    });

    res.json({ message: 'Availability updated', volunteer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/volunteer/me
exports.getMyVolunteerProfile = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ userId: req.user._id }).populate('userId', 'name email phone');
    if (!volunteer) return res.status(404).json({ error: 'Volunteer profile not found' });
    res.json({ volunteer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/volunteer/profile
exports.updateMyVolunteerProfile = async (req, res) => {
  try {
    const { skills, organization, experience, certifications } = req.body;
    const payload = {
      organization: organization || '',
      experience: Number(experience) || 0,
      certifications: Array.isArray(certifications) ? certifications : [],
    };

    if (Array.isArray(skills)) {
      payload.skills = skills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 10);
    }

    const volunteer = await Volunteer.findOneAndUpdate(
      { userId: req.user._id },
      payload,
      { new: true, runValidators: true }
    ).populate('userId', 'name email phone');

    if (!volunteer) return res.status(404).json({ error: 'Volunteer profile not found' });
    res.json({ message: 'Volunteer profile updated', volunteer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/volunteer/history
exports.getVolunteerMissionHistory = async (req, res) => {
  try {
    const requests = await RescueRequest.find({
      assignedVolunteer: req.user._id,
      status: { $in: ['rescued', 'cancelled'] },
    })
      .populate('userId', 'name phone email')
      .sort({ resolvedAt: -1, createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/volunteer/stats
exports.getVolunteerStats = async (req, res) => {
  try {
    const [summary, responseTime, volunteerProfile] = await Promise.all([
      RescueRequest.aggregate([
        { $match: { assignedVolunteer: req.user._id } },
        {
          $group: {
            _id: null,
            totalMissions: { $sum: 1 },
            completedMissions: {
              $sum: {
                $cond: [{ $eq: ['$status', 'rescued'] }, 1, 0],
              },
            },
            cancelledMissions: {
              $sum: {
                $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0],
              },
            },
            activeMissions: {
              $sum: {
                $cond: [{ $in: ['$status', ['accepted', 'in-progress']] }, 1, 0],
              },
            },
          },
        },
      ]),
      RescueRequest.aggregate([
        {
          $match: {
            assignedVolunteer: req.user._id,
            acceptedAt: { $ne: null },
          },
        },
        {
          $project: {
            responseMinutes: {
              $divide: [{ $subtract: ['$acceptedAt', '$createdAt'] }, 60000],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseMinutes: { $avg: '$responseMinutes' },
          },
        },
      ]),
      Volunteer.findOne({ userId: req.user._id }).select('rating ratingCount availability completedMissions'),
    ]);

    const base = summary[0] || {
      totalMissions: 0,
      completedMissions: 0,
      cancelledMissions: 0,
      activeMissions: 0,
    };

    const stats = {
      totalMissions: base.totalMissions,
      completedMissions: base.completedMissions,
      cancelledMissions: base.cancelledMissions,
      activeMissions: base.activeMissions,
      avgResponseMinutes: Number((responseTime[0]?.avgResponseMinutes || 0).toFixed(1)),
      rating: volunteerProfile?.rating || 0,
      ratingCount: volunteerProfile?.ratingCount || 0,
      availability: volunteerProfile?.availability || 'offline',
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
