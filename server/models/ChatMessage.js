/**
 * ChatMessage Model - Real-time messaging between users and volunteers
 */
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rescueRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RescueRequest',
  },
  message: {
    type: String,
    required: [true, 'Message cannot be empty'],
    maxlength: [1000, 'Message too long'],
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location', 'system'],
    default: 'text',
  },
  deliveryStatus: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  deliveredAt: Date,
  readAt: Date,
  isRead: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

chatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
