/**
 * RescueRequest Model - Tracks all emergency rescue requests
 */
const mongoose = require('mongoose');

const rescueRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: String,
  },
  disasterType: {
    type: String,
    enum: ['flood', 'earthquake', 'fire', 'landslide', 'cyclone', 'tsunami', 'other'],
    required: [true, 'Disaster type is required'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description too long'],
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high',
  },
  numberOfPeople: {
    type: Number,
    default: 1,
    min: 1,
  },
  images: [String], // URLs to uploaded images
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'rescued', 'cancelled', 'failed'],
    default: 'pending',
  },
  assignedVolunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAt: Date,
  statusHistory: [{
    status: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    note: String,
  }],
  citizenFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      maxlength: 1000,
    },
    ratedAt: Date,
  },
  acceptedAt: Date,
  escalationNotified: {
    type: Boolean,
    default: false,
  },
  escalationNotifiedAt: Date,
  volunteerRejections: [{
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      maxlength: 600,
    },
    rejectedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: Date,
});

rescueRequestSchema.index({ location: '2dsphere' });
rescueRequestSchema.index({ status: 1, createdAt: -1 });
rescueRequestSchema.index({ escalationNotified: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('RescueRequest', rescueRequestSchema);
