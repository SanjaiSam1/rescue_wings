/**
 * Auth Controller - Registration, Login, Profile
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/activityLogger');
const { sendMail, MailConfigurationError } = require('../utils/mailer');
const { createNotificationsForUsers } = require('../utils/notificationService');
const TEST_OTP = '123456';

const isMailConfigError = (error) => error instanceof MailConfigurationError || error.code === 'MAIL_NOT_CONFIGURED';
const isDevelopmentMode = () => process.env.NODE_ENV !== 'production';

const handleAuthError = (res, error) => {
  if (isMailConfigError(error)) {
    return res.status(503).json({
      error: 'Email service is not configured on the server. Please contact support/admin.',
      code: 'MAIL_NOT_CONFIGURED',
    });
  }

  return res.status(500).json({ error: error.message });
};

const generateToken = (id, rememberMe = false) => {
  const defaultExpiry = process.env.JWT_EXPIRE || '7d';
  const rememberExpiry = process.env.JWT_REMEMBER_EXPIRE || '30d';

  return jwt.sign({ id }, process.env.JWT_SECRET || 'rescue_wings_secret', {
    expiresIn: rememberMe ? rememberExpiry : defaultExpiry,
  });
};

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const extractDeviceInfo = (req) => {
  const ua = String(req.headers['user-agent'] || 'Unknown Device').trim();
  return ua.slice(0, 240);
};

const sendPasswordResetEmail = async (email, resetLink) => {
  const subject = 'Rescue Wings: Reset your password';
  const text = `Reset your Rescue Wings password using this link (valid for 30 minutes): ${resetLink}`;
  const html = `<p>Reset your Rescue Wings password using the link below (valid for 30 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p>`;
  await sendMail({ to: email, subject, text, html });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      age,
      address,
      idNumber,
      specificationType,
      role,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRole = String(role || 'citizen').trim().toLowerCase();
    if (!['citizen', 'volunteer'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Only citizen and volunteer registrations are allowed.' });
    }

    if (!age || !address || !idNumber || !specificationType) {
      return res.status(400).json({
        error: 'Age, address, ID number, and specification type are required.',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userRole = normalizedRole;
    const isCitizen = userRole === 'citizen';
    const proofDocumentUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,
      age: Number(age),
      address,
      idNumber,
      specificationType,
      proofDocumentUrl,
      role: userRole,
      isActive: true,
      isEmailVerified: true,
    });

    // Create pending volunteer profile for approval workflow.
    if (userRole === 'volunteer') {
      const volunteerProfile = await Volunteer.create({
        userId: user._id,
        verificationStatus: 'pending',
        availability: 'offline',
      });

      const io = req.app.get('io');
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
      await createNotificationsForUsers(io, {
        userIds: admins.map((a) => a._id),
        role: 'admin',
        type: 'volunteer-request',
        message: `New Volunteer Request - ${name} is awaiting approval.`,
        linkedId: volunteerProfile._id,
        data: {
          volunteerId: String(volunteerProfile._id),
          volunteerUserId: String(user._id),
          volunteerName: name,
          actionPath: '/admin?tab=approval-workflow',
        },
      });
    }

    if (isCitizen) {
      const token = generateToken(user._id, false);
      return res.status(201).json({
        message: 'Registration successful. Your citizen profile is active now.',
        token,
        tokenMode: 'default',
        requiresApproval: false,
        user: user.toSafeObject(),
      });
    }

    return res.status(201).json({
      message: 'Your volunteer application has been submitted. You will be approved once the admin validates your details. Please wait a few minutes.',
      requiresApproval: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    handleAuthError(res, error);
  }
};

// POST /api/auth/verify-otp
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.isEmailVerified) {
      const token = generateToken(user._id, false);
      return res.json({
        message: 'Email already verified. Redirecting to your dashboard.',
        token,
        tokenMode: 'default',
        user: user.toSafeObject(),
      });
    }

    const isValidOtp = String(otp).trim() === TEST_OTP;
    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    user.isEmailVerified = true;
    user.isActive = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.emailOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, false);
    res.json({
      message: 'Email verified successfully. Redirecting to your dashboard.',
      token,
      tokenMode: 'default',
      user: user.toSafeObject(),
    });
  } catch (error) {
    handleAuthError(res, error);
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashValue(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;
    let devResetLink = null;
    let warning = null;
    try {
      await sendPasswordResetEmail(email, resetLink);
    } catch (error) {
      if (!isDevelopmentMode() || !isMailConfigError(error)) throw error;
      devResetLink = resetLink;
      warning = 'SMTP is not configured. Using development reset-link fallback.';
    }

    res.json({ message: 'If that email exists, a reset link has been sent.', devResetLink, warning });
  } catch (error) {
    handleAuthError(res, error);
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.status(400).json({ error: 'Email, token and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires +password');
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: 'Reset link expired.' });
    }

    const isValidToken = hashValue(token) === user.passwordResetToken;
    if (!isValidToken) {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. Please login.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, role, rememberMe = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: `Selected role does not match this account. Account role: ${user.role}` });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Email not verified. Please verify OTP first.', requiresVerification: true, email: user.email });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated. Contact support.' });
    }

    if (user.role === 'volunteer') {
      const volunteerProfile = await Volunteer.findOne({ userId: user._id });
      if (!volunteerProfile || volunteerProfile.verificationStatus !== 'approved') {
        return res.status(403).json({ error: 'Your account is pending admin approval. Please wait.' });
      }
    }

    const now = new Date();
    const device = extractDeviceInfo(req);
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 120);

    user.lastSeen = now;
    user.isOnline = true;
    user.lastLoginAt = now;
    user.lastLoginDevice = device;
    user.loginHistory = [{ at: now, ip, device }, ...(user.loginHistory || [])].slice(0, 20);
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, Boolean(rememberMe));

    await logActivity({
      user,
      action: 'login',
      entityType: 'auth',
      details: `User logged in successfully from ${device}`,
      req,
    });

    res.json({
      message: 'Login successful',
      token,
      tokenMode: rememberMe ? 'remember' : 'default',
      user: user.toSafeObject(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const now = new Date();
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: now,
    }, { new: false });

    const io = req.app.get('io');
    io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').to('citizen').to('role_citizen').emit('presence:update', {
      userId: String(req.user._id),
      isOnline: false,
      lastSeen: now,
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const { rememberMe = false } = req.body || {};
    const token = generateToken(req.user._id, Boolean(rememberMe));
    res.json({ token, tokenMode: rememberMe ? 'remember' : 'default' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/auth/activity-log
exports.getUserActivityLog = async (req, res) => {
  try {
    const { page = 1, limit = 50, role, action } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (action) filter.action = action;

    const logs = await ActivityLog.find(filter)
      .populate('userId', 'name email role lastSeen')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      logs,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/auth/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user: user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, location, emergencyContacts } = req.body;
    const updatePayload = { name, phone, location };

    if (Array.isArray(emergencyContacts)) {
      updatePayload.emergencyContacts = emergencyContacts
        .filter((c) => c && c.name && c.phone)
        .slice(0, 3)
        .map((c) => ({
          name: String(c.name).trim(),
          phone: String(c.phone).trim(),
          relation: c.relation ? String(c.relation).trim() : '',
        }));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updatePayload,
      { new: true, runValidators: true }
    );
    res.json({ message: 'Profile updated', user: user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/auth/users-summary
exports.getUsersSummary = async (req, res) => {
  try {
    const byRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalUsers = byRole.reduce((sum, r) => sum + r.count, 0);
    const activeUsers = byRole.reduce((sum, r) => sum + r.activeCount, 0);

    res.json({ totalUsers, activeUsers, byRole });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
