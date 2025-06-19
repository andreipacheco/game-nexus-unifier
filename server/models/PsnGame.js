const mongoose = require('mongoose');

const PsnGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for faster queries by user
  },
  npCommunicationId: { // Game ID from PSN (e.g., "NPWR00123_00")
    type: String,
    required: true
  },
  trophyTitleName: { // Game name
    type: String,
    required: true
  },
  trophyTitleIconUrl: {
    type: String
  },
  trophyTitlePlatform: { // Platform like "PS5", "PS4"
    type: String
  },
  trophySetVersion: {
    type: String
  },
  lastUpdatedDateTime: { // ISO date string from PSN, when trophy info for this game was last updated for the user
    type: Date
  },
  definedTrophies: {
    bronze: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 }
  },
  earnedTrophies: {
    bronze: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 }
  },
  lastFetched: { // Timestamp of when this record was last fetched/updated from PSN API
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a game (npCommunicationId) is unique per user
PsnGameSchema.index({ userId: 1, npCommunicationId: 1 }, { unique: true });

module.exports = mongoose.model('PsnGame', PsnGameSchema);
