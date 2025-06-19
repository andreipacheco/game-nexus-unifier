const express = require('express');
const logger = require('../config/logger');
const User = require('../models/User');
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getProfileFromAccountId,
} = require('psn-api');

const router = express.Router();

// POST /api/psn/connect
router.post('/connect', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { npsso } = req.body;
  if (!npsso) {
    return res.status(400).json({ message: 'NPSSO token is required' });
  }

  try {
    logger.info(`Attempting to connect PSN account for user ${req.user.id} with provided NPSSO.`);
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    logger.info(`Successfully exchanged NPSSO for access code for user ${req.user.id}.`);

    const authTokens = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully exchanged access code for auth tokens for user ${req.user.id}.`);

    const { accessToken, refreshToken } = authTokens; // refreshToken can be stored for future use if needed

    const profile = await getProfileFromAccountId({ accessToken }, "me");
    logger.info(`Successfully fetched PSN profile for user ${req.user.id}: ${profile.onlineId}`);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        npsso, // Save the original NPSSO for future direct use if the library supports/requires it
        psnAccountId: profile.accountId,
        psnOnlineId: profile.onlineId,
        // Optionally store accessToken and refreshToken if your strategy involves refreshing them
        // For now, we'll re-authenticate with NPSSO each time for simplicity in this example
      },
      { new: true }
    ).select('-password -npsso'); // Exclude password and npsso from the returned user object

    if (!user) {
      logger.warn(`User not found during PSN connect process for ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'PSN account connected successfully',
      psnProfile: {
        accountId: profile.accountId,
        onlineId: profile.onlineId,
        avatarUrl: profile.avatarUrls?.[0]?.avatarUrl, // Example of fetching additional profile data
      },
      user, // Send back the updated user object (excluding sensitive fields)
    });

  } catch (error) {
    logger.error(`Error connecting PSN account for user ${req.user.id}:`, error);
    if (error.message && error.message.includes("NPSSO code is expired or invalid")) {
        return res.status(400).json({ message: 'Invalid or expired NPSSO token. Please provide a new one.' });
    }
    // Generic error for other psn-api or database issues
    res.status(500).json({ message: 'Failed to connect to PSN. Please ensure your NPSSO is correct and try again.' });
  }
});

// GET /api/psn/games
router.get('/games', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.npsso) {
      return res.status(400).json({ message: 'PSN account not connected. Please connect your PSN account first via POST /api/psn/connect.' });
    }

    logger.info(`Fetching PSN games for user ${user.id} (${user.psnOnlineId}). Exchanging NPSSO for access code.`);
    const accessCode = await exchangeNpssoForAccessCode(user.npsso);
    logger.info(`Successfully exchanged NPSSO for access code for user ${user.id}. Now exchanging for auth tokens.`);

    const { accessToken } = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully obtained access token for user ${user.id}. Fetching user titles.`);

    const psnUserTitles = await getUserTitles({ accessToken }, "me");
    logger.info(`Successfully fetched ${psnUserTitles.titles.length} titles for user ${user.id}.`);

    res.json({
        message: 'PSN games fetched successfully',
        games: psnUserTitles.titles,
        totalGames: psnUserTitles.totalItemCount,
    });

  } catch (error) {
    logger.error(`Error fetching PSN games for user ${req.user?.id}:`, error);
    if (error.message && error.message.includes("NPSSO code is expired or invalid")) {
        return res.status(401).json({ message: 'NPSSO token is invalid or expired. Please reconnect your PSN account.' });
    }
    res.status(500).json({ message: 'Error fetching PSN games.' });
  }
});

module.exports = router;
