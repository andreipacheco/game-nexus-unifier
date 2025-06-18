const mongoose = require('mongoose');

const PsnGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  npCommunicationId: { // Unique ID for the game on PSN
    type: String,
    required: true,
  },
  trophyTitleName: {
    type: String,
    required: true,
  },
  trophyTitleIconUrl: String,
  trophyTitlePlatform: String, // e.g., "PS5", "PS4"
  // definedTrophies: { // Total available trophies in the game
  //   bronze: { type: Number, default: 0 },
  //   silver: { type: Number, default: 0 },
  //   gold: { type: Number, default: 0 },
  //   platinum: { type: Number, default: 0 },
  // },
  progress: { // Overall progress percentage for trophies
    type: Number,
    default: 0
  },
  earnedTrophies: { // Trophies earned by the user for this game
    bronze: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 },
  },
  lastUpdatedFromPsn: { // Timestamp of when this data was last synced from PSN API
    type: Date,
  },
  // Add a general platform field for easier cross-platform querying
  platform: {
    type: String,
    default: 'PSN',
  },
  // Add any other fields from the psn-api response you want to store
  // For example, from UserTitle: hasTrophyGroups
  hasTrophyGroups: Boolean,
}, { timestamps: true }); // Add createdAt and updatedAt timestamps

// Compound index to ensure a game is unique per user
PsnGameSchema.index({ userId: 1, npCommunicationId: 1 }, { unique: true });

module.exports = mongoose.model('PsnGame', PsnGameSchema);
