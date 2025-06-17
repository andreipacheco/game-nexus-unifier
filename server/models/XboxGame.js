const mongoose = require('mongoose');

const xboxGameSchema = new mongoose.Schema({
  xuid: { type: String, required: true, index: true }, // Xbox User ID
  titleId: { type: String, required: true, index: true }, // Game ID (can be a string or number depending on API)
  name: { type: String, required: true },
  displayImage: { type: String }, // URL for game's display image/box art
  achievements: {
    currentAchievements: { type: Number, default: 0 }, // Unlocked achievements
    totalAchievements: { type: Number, default: 0 },   // Total possible achievements
    currentGamerscore: { type: Number, default: 0 },   // Current gamerscore from this game
    totalGamerscore: { type: Number, default: 0 },     // Total possible gamerscore from this game
  },
  lastUpdated: { type: Date, default: Date.now },
  // Potentially add other fields based on what xbl.io API provides, e.g.:
  // lastPlayed: { type: Date },
  // platform: { type: String }, // e.g., "Xbox One", "Xbox Series X/S"
});

// Compound index to ensure uniqueness for a user's game
xboxGameSchema.index({ xuid: 1, titleId: 1 }, { unique: true });

const XboxGame = mongoose.model('XboxGame', xboxGameSchema);

module.exports = XboxGame;
