/**
 * Alert Model - Emergency broadcasts and disaster alerts
 */
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Alert title is required'],
    maxlength: 200,
  },
  message: {
    type: String,
    required: [true, 'Alert message is required'],
    maxlength: 2000,
  },
  type: {
    type: String,
    enum: ['warning', 'danger', 'info', 'evacuation'],
    default: 'warning',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high',
  },
  targetRole: {
    type: String,
    enum: ['all', 'citizen', 'volunteer'],
    default: 'all',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: [Number],
    address: String,
    radius: Number, // affected radius in km
  },
  affectedAreas: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

alertSchema.index({ createdAt: -1 });
alertSchema.index({ isActive: 1 });

module.exports = mongoose.model('Alert', alertSchema);
