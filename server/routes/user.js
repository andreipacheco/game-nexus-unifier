const express = require('express');
const router = express.Router();
// User model is not directly needed here if req.user is populated by Passport
const logger = require('../config/logger');

// GET /api/me - Fetches the authenticated user's profile information
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    // req.user is populated by Passport's deserializeUser
    // It should contain the full Mongoose User document.
    // We select only the fields safe to send to the frontend.
    const { steamId, personaName, avatar, profileUrl } = req.user;

    // Ensure avatar is named avatarFull to match frontend context expectations
    const profileData = {
      steamId,
      personaName,
      avatarFull: avatar, // Map 'avatar' from DB to 'avatarFull' for context
      profileUrl
    };

    logger.debug('Authenticated user profile requested.', { steamId: req.user.steamId });
    res.json(profileData);
  } else {
    logger.debug('Unauthenticated user attempted to access /api/me.');
    res.status(401).json({ error: 'User not authenticated' });
  }
});

module.exports = router;
