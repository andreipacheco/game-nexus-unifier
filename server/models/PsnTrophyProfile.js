const mongoose = require('mongoose');

const PsnTrophyProfileSchema = new mongoose.Schema({
  userId: { // Link to the user
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user should have only one PSN trophy profile
  },
  psnAccountId: { // User's PSN account ID
    type: String,
    required: true,
    unique: true, // This should also be unique if not tied to userId alone
  },
  trophyLevel: {
    type: Number,
    required: true,
  },
  progress: { // Progress to the next trophy level
    type: Number,
    required: true,
  },
  tier: { // Current trophy tier (e.g., Bronze, Silver, Gold)
    type: Number,
    required: true,
  },
  earnedTrophies: { // Overall earned trophy counts
    bronze: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 },
  },
  lastUpdatedFromPsn: { // Timestamp of when this data was last synced from PSN API
    type: Date,
  },
}, { timestamps: true }); // Add createdAt and updatedAt timestamps

module.exports = mongoose.model('PsnTrophyProfile', PsnTrophyProfileSchema);
