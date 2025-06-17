const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  steamId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents to have null/undefined for this field if not provided
    // This is useful if a user in our system hasn't connected their Steam account yet.
  },
  personaName: {
    type: String,
    trim: true, // Removes whitespace from both ends of a string
  },
  avatar: {
    type: String, // URL to the Steam avatar
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
  // You might want to add other fields from Steam user summary, e.g.,
  // realName: String,
  // countryCode: String,
  // etc.

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // lastSteamSync: Date, // Could be useful to track when Steam data was last updated
});

// Optional: Add an index on steamId for faster queries if you frequently find users by it.
// mongoose.model() will automatically create indexes defined in the schema
// when the application starts up, provided it's not disabled.

module.exports = mongoose.model('User', UserSchema);
