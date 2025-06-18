const mongoose = require('mongoose');

const playstationGameSchema = new mongoose.Schema({
  userId: { // This will be our internal User's ObjectId as string or a hashed NPSSO/account identifier
    type: String, // Or mongoose.Schema.Types.ObjectId if linking directly to User model _id
    required: true,
    index: true
  },
  titleId: { // Unique ID for the game from PSN (e.g., CUSAXXXXX)
    type: String,
    required: true,
    index: true
  },
  name: { // Name of the game
    type: String,
    required: true
  },
  image: { // URL for the game's cover image
    type: String
  },
  platform: { // e.g., "PS4", "PS5", "PSVITA". The API response should indicate this.
    type: String,
    // Consider a more generic default or make it required if always available from API
    default: 'Playstation' // Defaulting to a generic Playstation, can be updated based on API response
  },
  trophySummary: {
    progress: { type: Number, default: 0 }, // Percentage completion for trophies
    earnedTrophies: { // Count of earned trophies by type
      bronze: { type: Number, default: 0 },
      silver: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      platinum: { type: Number, default: 0 }
    },
    // totalTrophies: { type: Number, default: 0 } // Total available trophies for the base game.
    // This might be better sourced from a separate trophy list call for the game.
    // The getUserTitles endpoint provides `definedTrophies` which could be used here.
    definedTrophies: { // From `trophyTitles[].definedTrophies`
        bronze: { type: Number, default: 0 },
        silver: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        platinum: { type: Number, default: 0 }
    }
  },
  lastPlayedDateTime: { // If available from API (e.g. from `getRecentlyPlayedGames` or `getUserPlayedGames`)
    type: Date
  },
  playDuration: { // If available from API (e.g. from `getUserPlayedGames`)
    type: String // e.g., "PT12H34M56S" or store as seconds
  },
  lastUpdated: { // When our system last updated this game's details
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure uniqueness for a user's game entry based on titleId
playstationGameSchema.index({ userId: 1, titleId: 1 }, { unique: true });

// Pre-save hook to update lastUpdated timestamp
playstationGameSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const PlaystationGame = mongoose.model('PlaystationGame', playstationGameSchema);

module.exports = PlaystationGame;
