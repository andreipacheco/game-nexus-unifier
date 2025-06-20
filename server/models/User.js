const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined if not signing up with Google
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    // Not required, so users signing up with Google don't need a password
  },
  steamId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents to have null/undefined for this field if not provided
  },
  npsso: {
    type: String,
    unique: true,
    sparse: true,
  },
  psnAccountId: {
    type: String,
    sparse: true,
  },
  psnOnlineId: {
    type: String,
    sparse: true,
  },
  xuid: {
    type: String,
    unique: true,
    sparse: true,
  },
  personaName: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String, // URL to the Steam avatar or Google profile picture
  },
  profileUrl: {
    type: String, // URL to the Steam profile
  },
  lastLoginAt: {
    type: Date,
  },
  lastLogoutAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema);
