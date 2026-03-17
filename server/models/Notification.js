const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['citizen', 'volunteer', 'admin'],
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['sos', 'sos-status', 'volunteer-request', 'chat'],
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  linkedId: {
    type: String,
    default: '',
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);