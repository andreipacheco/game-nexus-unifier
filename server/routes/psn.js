const express = require('express');
const logger = require('../config/logger');
const User = require('../models/User');
const PsnGame = require('../models/PsnGame'); // Import PsnGame Model
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getProfileFromAccountId,
} = require('psn-api');
const jwtDecode = require('jwt-decode');

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

    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully exchanged access code for auth tokens for user ${req.user.id}.`);

    if (!authorization.idToken) {
      logger.error(`idToken not found in PSN authorization response for user ${req.user.id}.`);
      return res.status(500).json({ message: 'Failed to retrieve idToken from PSN. Cannot determine account ID.' });
    }

    const decodedIdToken = jwtDecode(authorization.idToken);
    logger.info(`Decoded idToken for user ${req.user.id}:`, decodedIdToken);

    const accountIdFromToken = decodedIdToken?.sub;
    if (!accountIdFromToken) {
      logger.error(`accountId (sub) not found in decoded idToken for user ${req.user.id}. Decoded token: ${JSON.stringify(decodedIdToken)}`);
      return res.status(500).json({ message: 'Failed to extract accountId from PSN idToken.' });
    }
    logger.info(`Extracted accountId ${accountIdFromToken} from idToken for user ${req.user.id}.`);

    const { accessToken } = authorization; // refreshToken also available if needed

    const userPSNProfile = await getProfileFromAccountId({ accessToken }, accountIdFromToken);
    logger.info(`Successfully fetched PSN profile for user ${req.user.id} using accountId ${accountIdFromToken}: ${userPSNProfile.onlineId}`);

    const existingUserWithNpsso = await User.findOne({ npsso: npsso, _id: { $ne: req.user.id } });
    if (existingUserWithNpsso) {
      logger.warn(`User ${req.user.id} attempting to connect NPSSO token that is already in use by user ${existingUserWithNpsso._id}.`);
      return res.status(409).json({ message: 'This PSN account (NPSSO token) is already linked to a different user account in Game Nexus Unifier.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        npsso,
        psnAccountId: accountIdFromToken,
        psnOnlineId: userPSNProfile.onlineId,
      },
      { new: true }
    ).select('-password -npsso');

    if (user) { // Check if user is not null before logging its properties
       logger.info(`User data after PSN update (selected for response): id: ${user._id}, psnAccountId: ${user.psnAccountId}, psnOnlineId: ${user.psnOnlineId}`);
    }

    if (!user) {
      logger.warn(`User not found during PSN connect process for ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'PSN account connected successfully',
      psnProfile: {
        accountId: accountIdFromToken,
        onlineId: userPSNProfile.onlineId,
        avatarUrl: userPSNProfile.avatarUrls?.[0]?.avatarUrl,
      },
      user,
    });

  } catch (error) {
    logger.error(`Error connecting PSN account for user ${req.user.id}:`, error);
    if (error.message && (error.message.includes("NPSSO code is expired or invalid") || error.message.includes("authentication_error") )) {
        return res.status(400).json({ message: 'Invalid or expired NPSSO token. Please provide a new one.' });
    }
    if (error.code === 'ECONNRESET' || error.message.includes('timed out')) {
      logger.error(`PSN API connection timed out for user ${req.user.id}:`, error);
      return res.status(504).json({ message: 'Connection to PSN API timed out. Please try again later.' });
    }
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

    // --- MongoDB Cache Check ---
    const cacheValidityPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const twentyFourHoursAgo = new Date(Date.now() - cacheValidityPeriod);

    const cachedGames = await PsnGame.find({
      userId: req.user.id,
      lastFetched: { $gte: twentyFourHoursAgo }
    }).sort({ trophyTitleName: 1 });

    if (cachedGames.length > 0) {
      logger.info(`Serving ${cachedGames.length} PSN games from cache for user ${req.user.id}.`);
      return res.json({
        message: 'PSN games fetched successfully from cache.',
        games: cachedGames,
        totalGames: cachedGames.length,
        source: 'cache'
      });
    }
    logger.info(`No fresh PSN games in cache for user ${req.user.id}. Fetching from PSN API.`);
    // --- End MongoDB Cache Check ---

    logger.info(`Fetching PSN games for user ${user.id} (${user.psnOnlineId || 'N/A'}). Exchanging NPSSO for access code.`);
    const accessCode = await exchangeNpssoForAccessCode(user.npsso);
    logger.info(`Successfully exchanged NPSSO for access code for user ${user.id}. Now exchanging for auth tokens.`);

    const { accessToken } = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully obtained access token for user ${user.id}. Fetching user titles.`);

    const psnUserTitlesResponse = await getUserTitles({ accessToken }, "me");
    logger.info(`Successfully fetched ${psnUserTitlesResponse.trophyTitles?.length ?? 0} titles from PSN API for user ${user.id}.`);

    const fetchedGames = psnUserTitlesResponse.trophyTitles || [];
    let savedGamesCount = 0;

    if (fetchedGames.length > 0) {
      logger.info(`Saving/updating ${fetchedGames.length} PSN games to MongoDB for user ${req.user.id}.`);
      for (const gameDetail of fetchedGames) {
        const gameDataToSave = {
          userId: req.user.id,
          npCommunicationId: gameDetail.npCommunicationId,
          trophyTitleName: gameDetail.trophyTitleName,
          trophyTitleIconUrl: gameDetail.trophyTitleIconUrl,
          trophyTitlePlatform: gameDetail.trophyTitlePlatform,
          trophySetVersion: gameDetail.trophySetVersion,
          lastUpdatedDateTime: gameDetail.lastUpdatedDateTime ? new Date(gameDetail.lastUpdatedDateTime) : undefined,
          definedTrophies: gameDetail.definedTrophies,
          earnedTrophies: gameDetail.earnedTrophies,
          lastFetched: new Date()
        };

        try {
          await PsnGame.findOneAndUpdate(
            { userId: req.user.id, npCommunicationId: gameDetail.npCommunicationId },
            gameDataToSave,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          savedGamesCount++;
        } catch (dbSaveError) {
          logger.error(`Failed to save PSN game ${gameDetail.npCommunicationId} to MongoDB for user ${req.user.id}:`, {
            errorMessage: dbSaveError.message,
            // gameData: gameDataToSave // Be cautious logging full gameData
          });
        }
      }
      logger.info(`Finished saving/updating ${savedGamesCount} PSN games to MongoDB for user ${req.user.id}.`);
    }

    const finalGamesToReturn = await PsnGame.find({ userId: req.user.id }).sort({ trophyTitleName: 1 });

    res.json({
        message: 'PSN games fetched successfully from API and updated in DB.',
        games: finalGamesToReturn,
        totalGames: finalGamesToReturn.length, // psnUserTitlesResponse.totalItemCount might be more accurate from API
        source: 'api'
    });

  } catch (error) {
    logger.error(`Error fetching PSN games for user ${req.user?.id}:`, error);
    if (error.message && (error.message.includes("NPSSO code is expired or invalid") || error.message.includes("authentication_error"))) {
        return res.status(401).json({ message: 'NPSSO token is invalid or expired. Please reconnect your PSN account.' });
    }
    if (error.code === 'ECONNRESET' || error.message.includes('timed out')) {
      logger.error(`PSN API connection timed out during games fetch for user ${req.user?.id}:`, error);
      return res.status(504).json({ message: 'Connection to PSN API timed out while fetching games. Please try again later.' });
    }
    res.status(500).json({ message: 'Error fetching PSN games.' });
  }
});

module.exports = router;
