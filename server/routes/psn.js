const express = require('express');
const router = express.Router();
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getUserTrophyProfileSummary
} = require('psn-api');
const PsnGame = require('../models/PsnGame');
const PsnTrophyProfile = require('../models/PsnTrophyProfile');
// User model is not strictly needed here if req.user.id is populated by ensureAuthenticated
// const User = require('../models/User');
const { ensureAuthenticated } = require('../config/passportConfig'); // For req.user

// Middleware to extract access token from Authorization header (for PSN API calls)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: 'Access token is required.' });
  }

  req.accessToken = token;
  next();
};

// Route to initiate PSN authentication (POST with NPSSO token)
router.post('/initiate-auth', async (req, res) => {
  const { npsso } = req.body;

  if (!npsso) {
    return res.status(400).json({ error: 'NPSSO token is required.' });
  }

  try {
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    res.status(200).json({ message: 'NPSSO exchanged for access code. Ready to get auth tokens.', accessCode });
  } catch (error) {
    console.error('Error exchanging NPSSO for access code:', error);
    // Log the actual error for server-side debugging
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange NPSSO for access code.', details: error.message });
  }
});

// Route to exchange access code for auth tokens
router.post('/exchange-code', async (req, res) => {
  const { accessCode } = req.body;

  if (!accessCode) {
    return res.status(400).json({ error: 'Access code is required.' });
  }

  try {
    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    // In a real app, store tokens securely (e.g., HTTP-only cookie or session)
    // For now, returning them. Client should handle them securely.
    res.status(200).json({ message: 'Successfully obtained PSN auth tokens.', authorization });
  } catch (error) {
    console.error('Error exchanging access code for auth tokens:', error);
    // Log the actual error for server-side debugging
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange access code for auth tokens.', details: error.message });
  }
});

// Route to get user's game titles and save them
router.get('/games', ensureAuthenticated, authenticateToken, async (req, res) => {
  try {
    const userTitlesResponse = await getUserTitles(
      { accessToken: req.accessToken },
      "me" // "me" refers to the authenticated user
    );

    if (userTitlesResponse && userTitlesResponse.trophyTitles) {
      const userId = req.user.id; // Populated by ensureAuthenticated

      for (const title of userTitlesResponse.trophyTitles) {
        const gameData = {
          userId: userId,
          npCommunicationId: title.npCommunicationId,
          trophyTitleName: title.trophyTitleName,
          trophyTitleIconUrl: title.trophyTitleIconUrl,
          trophyTitlePlatform: title.trophyTitlePlatform,
          progress: title.progress,
          earnedTrophies: title.earnedTrophies,
          hasTrophyGroups: title.hasTrophyGroups,
          platform: 'PSN',
          lastUpdatedFromPsn: new Date(),
        };
        await PsnGame.findOneAndUpdate(
          { userId: userId, npCommunicationId: title.npCommunicationId },
          gameData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      console.log(`Saved/Updated ${userTitlesResponse.trophyTitles.length} PSN games for user ${userId}`);
      res.status(200).json({ message: 'PSN games fetched and synced successfully.', data: userTitlesResponse });
    } else {
      res.status(200).json({ message: 'No PSN games found or empty response from API.', data: userTitlesResponse });
    }
  } catch (error) {
    console.error('Error fetching and syncing user PSN game titles:', error);
    // console.error(error.response?.data || error.message); // For psn-api specific errors
    res.status(500).json({ error: 'Failed to fetch and sync user PSN game titles.', details: error.message });
  }
});

// Route to get user's trophy summary and save it
router.get('/trophy-summary', ensureAuthenticated, authenticateToken, async (req, res) => {
  try {
    const trophySummaryResponse = await getUserTrophyProfileSummary(
      { accessToken: req.accessToken },
      "me" // "me" refers to the authenticated user
    );

    if (trophySummaryResponse) {
      const userId = req.user.id; // Populated by ensureAuthenticated

      const profileData = {
        userId: userId,
        psnAccountId: trophySummaryResponse.accountId,
        trophyLevel: trophySummaryResponse.trophyLevel,
        progress: trophySummaryResponse.progress,
        tier: trophySummaryResponse.tier,
        earnedTrophies: trophySummaryResponse.earnedTrophies,
        lastUpdatedFromPsn: new Date(),
      };
      await PsnTrophyProfile.findOneAndUpdate(
        { userId: userId }, // Each user has one PSN trophy profile
        profileData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Saved/Updated PSN trophy profile for user ${userId}`);
      res.status(200).json({ message: 'PSN trophy profile fetched and synced successfully.', data: trophySummaryResponse });
    } else {
      res.status(200).json({ message: 'No PSN trophy profile found or empty response from API.', data: trophySummaryResponse });
    }
  } catch (error) {
    console.error('Error fetching and syncing user PSN trophy summary:', error);
    // console.error(error.response?.data || error.message); // For psn-api specific errors
    res.status(500).json({ error: 'Failed to fetch and sync user PSN trophy summary.', details: error.message });
  }
});

module.exports = router;
