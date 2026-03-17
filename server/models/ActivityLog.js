/**
 * ActivityLog Model - Stores user login/actions for admin auditing
 */
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['citizen', 'volunteer', 'admin'],
    required: true,
  },
  action: {
    type: String,
    required: true,
    maxlength: 120,
  },
  entityType: {
    type: String,
    maxlength: 80,
  },
  entityId: String,
  details: {
    type: String,
    maxlength: 1500,
  },
  ip: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
