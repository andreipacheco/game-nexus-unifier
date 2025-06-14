const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming your User model is here
const logger = require('../config/logger'); // Import logger

// GET /api/user/steam_profile
// Fetches a user's Steam profile information from the local database
// Expects a steamid query parameter
router.get('/steam_profile', async (req, res) => {
  const { steamid } = req.query;

  if (!steamid) {
    return res.status(400).json({ error: 'SteamID query parameter is required.' });
  }

  try {
    const user = await User.findOne({ steamId: steamid });

    if (!user) {
      return res.status(404).json({ error: 'User not found with the provided SteamID.' });
    }

    // Return the relevant profile information
    // (personaName, avatar, profileUrl, steamId itself)
    res.json({
      steamId: user.steamId,
      personaName: user.personaName,
      avatarFull: user.avatar, // Match field name used in SteamContext (avatarFull)
      profileUrl: user.profileUrl,
    });

  } catch (error) {
    logger.error('Error fetching user profile from DB for steamid %s:', steamid, error);
    res.status(500).json({ error: 'Server error while fetching user profile.' });
  }
});

module.exports = router;
