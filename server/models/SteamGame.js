const mongoose = require('mongoose');

const steamGameSchema = new mongoose.Schema({
  steamId: { type: String, required: true, index: true },
  appId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  playtimeForever: { type: Number, required: true },
  imgIconURL: { type: String },
  imgLogoURL: { type: String },
  achievements: {
    unlocked: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  lastUpdated: { type: Date, default: Date.now },
});

// Compound index to ensure uniqueness for a user's game
steamGameSchema.index({ steamId: 1, appId: 1 }, { unique: true });

const SteamGame = mongoose.model('SteamGame', steamGameSchema);

module.exports = SteamGame;
