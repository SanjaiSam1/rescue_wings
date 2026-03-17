/**
 * Authentication Middleware - JWT verification and role-based access control
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');

// Verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rescue_wings_secret');
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Token invalid or user deactivated.' });
    }

    if (user.role === 'volunteer') {
      const volunteerProfile = await Volunteer.findOne({ userId: user._id });
      if (!volunteerProfile || volunteerProfile.verificationStatus !== 'approved') {
        return res.status(403).json({ error: 'Your account is pending admin approval. Please wait.' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    res.status(500).json({ error: 'Authentication error.' });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
