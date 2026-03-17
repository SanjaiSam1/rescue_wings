/**
 * Volunteer Model - Extended profile for volunteers/rescue teams
 */
const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  skills: [{
    type: String,
    enum: ['first-aid', 'swimming', 'driving', 'medical', 'search-rescue', 'firefighting', 'counseling', 'logistics', 'other'],
  }],
  organization: String,
  experience: {
    type: Number,
    default: 0, // years of experience
  },
  certifications: [String],
  availability: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verifiedAt: Date,
  verificationReason: {
    type: String,
    maxlength: 600,
  },
  activeRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RescueRequest',
  }],
  completedMissions: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
