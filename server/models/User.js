/**
 * User Model - Handles all user roles: citizen, volunteer, admin
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password in queries by default
  },
  phone: {
    type: String,
    trim: true,
  },
  age: {
    type: Number,
    min: 1,
    max: 120,
  },
  address: {
    type: String,
    trim: true,
    maxlength: 240,
  },
  idNumber: {
    type: String,
    trim: true,
    maxlength: 80,
  },
  specificationType: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  proofDocumentUrl: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  role: {
    type: String,
    enum: ['citizen', 'volunteer', 'admin'],
    default: 'citizen',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    address: String,
  },
  avatar: String,
  emergencyContacts: [{
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    relation: {
      type: String,
      trim: true,
      maxlength: 50,
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: true,
  },
  emailOtpHash: {
    type: String,
    select: false,
  },
  emailOtpExpires: {
    type: Date,
    select: false,
  },
  emailOtpAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  lastLoginAt: Date,
  lastLoginDevice: {
    type: String,
    maxlength: 240,
  },
  loginHistory: [{
    at: Date,
    ip: String,
    device: String,
  }],
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create geospatial index
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Return safe user object (no password)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailOtpHash;
  delete obj.emailOtpExpires;
  delete obj.emailOtpAttempts;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
