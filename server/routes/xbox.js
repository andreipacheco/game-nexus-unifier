const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const axios = require('axios');
const XboxGame = require('../models/XboxGame'); // Import the XboxGame model

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Ensure XBL_API_KEY is loaded (typically from .env file)
const XBL_API_KEY = process.env.XBL_API_KEY;

if (!XBL_API_KEY) {
  logger.error('XBL_API_KEY is not defined in environment variables. Xbox API calls will fail.');
}

// Base URL for xbl.io API v2
const XBL_API_BASE_URL = 'https://xbl.io/api/v2';

// GET /api/xbox/user/:xuid/games - Fetches user's owned games and achievements from xbl.io
router.get('/user/:xuid/games', async (req, res) => {
  const { xuid } = req.params;

  if (!XBL_API_KEY) {
    return res.status(500).json({ error: 'Xbox API key not configured on server.' });
  }

  if (!xuid) {
    return res.status(400).json({ error: 'Xbox User ID (XUID) is required.' });
  }

  // --- MongoDB Cache Check ---
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dbGames = await XboxGame.find({
      xuid: xuid,
      lastUpdated: { $gte: twentyFourHoursAgo }
    }).sort({ name: 1 });

    if (dbGames.length > 0) {
      logger.info(`Serving ${dbGames.length} Xbox games from cache for xuid: ${xuid}`);
      return res.json(dbGames); // Return cached data
    }
    logger.info(`No fresh Xbox games in cache for xuid: ${xuid}. Fetching from xbl.io API.`);
  } catch (dbError) {
    logger.error('Error fetching Xbox games from MongoDB cache:', {
      xuid,
      errorMessage: dbError.message,
    });
    // Proceed to fetch from API as a fallback
  }
  // --- End MongoDB Cache Check ---

  try {
    logger.info(`Fetching Xbox games and achievements from xbl.io API for xuid: ${xuid}`);

    // According to xbl.io documentation, achievements endpoint seems to provide titles.
    // Let's use GET /achievements/player/{xuid}
    // This endpoint might require multiple calls if pagination is involved or if it only returns games with achievements.
    // We might need another endpoint for "all games" if this one is insufficient.
    // For now, assuming it gives us a list of games played by the user.
    const achievementsApiUrl = `${XBL_API_BASE_URL}/achievements/player/${xuid}`;

    const apiClient = axios.create({
      baseURL: XBL_API_BASE_URL,
      headers: {
        'X-Authorization': XBL_API_KEY,
        'Accept': 'application/json',
        'Accept-Language': 'en-US' // Optional: to get results in English
      }
    });

    const response = await apiClient.get(`/achievements/player/${xuid}`);
    let gamesWithDetails = [];

    if (response.data && response.data.titles) {
      const titles = response.data.titles;
      logger.info(`Fetched ${titles.length} titles (games) for xuid: ${xuid}.`);

      for (const title of titles) {
        // Basic game information from the titles array
        const gameInfo = {
          titleId: title.titleId,
          name: title.name,
          displayImage: title.displayImage, // Make sure this field exists or find the correct one
          achievements: {
            currentAchievements: title.achievement.currentAchievements,
            totalAchievements: title.achievement.totalAchievements,
            currentGamerscore: title.achievement.currentGamerscore,
            totalGamerscore: title.achievement.totalGamerscore,
          },
          // platform: title.platform, // If available
          // lastPlayed: title.lastUnlockDate ?? title.lastPlayed // If available
        };
        gamesWithDetails.push(gameInfo);

        // xbl.io API might have rate limits, though not explicitly detailed in public docs for v2.
        // Adding a small delay just in case.
        await delay(100);
      }
      logger.info(`Successfully processed ${gamesWithDetails.length} games for xuid: ${xuid}`);

      // --- Save to MongoDB ---
      if (gamesWithDetails.length > 0) {
        logger.info(`Saving/updating ${gamesWithDetails.length} Xbox games to MongoDB for xuid: ${xuid}`);
        for (const gameDetail of gamesWithDetails) {
          const gameDataToSave = {
            xuid: xuid,
            titleId: gameDetail.titleId,
            name: gameDetail.name,
            displayImage: gameDetail.displayImage,
            achievements: gameDetail.achievements,
            // platform: gameDetail.platform,
            // lastPlayed: gameDetail.lastPlayed,
            lastUpdated: new Date()
          };

          try {
            await XboxGame.findOneAndUpdate(
              { xuid: xuid, titleId: gameDetail.titleId },
              gameDataToSave,
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          } catch (dbSaveError) {
            logger.error(`Failed to save Xbox game ${gameDetail.titleId} to MongoDB for xuid ${xuid}:`, {
              errorMessage: dbSaveError.message,
              gameData: gameDataToSave
            });
          }
        }
        logger.info(`Finished saving/updating Xbox games to MongoDB for xuid: ${xuid}`);
      }
      // --- End Save to MongoDB ---

      res.json(gamesWithDetails); // Return the fresh data from API

    } else if (response.data && response.data.titles && response.data.titles.length === 0) {
      logger.info(`No Xbox games with achievements found for xuid: ${xuid} or profile might be private.`);
      res.json([]);
    } else {
      logger.warn('xbl.io API response structure was not as expected or empty for achievements/player.', { xuid, responseData: response.data });
      res.status(500).json({ error: 'Unexpected response structure from xbl.io API.' });
    }
  } catch (error) {
    let errorMessage = 'Failed to fetch Xbox games from xbl.io.';
    let errorDetails = {};

    if (error.response) {
      // Axios error with a response from the API
      logger.error(`${errorMessage} API responded with status ${error.response.status}:`, {
        xuid,
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      errorMessage = `Failed to fetch Xbox games. API responded with status ${error.response.status}.`;
      errorDetails = error.response.data;
       // Specific error messages based on xbl.io status codes
      if (error.response.status === 401) { // Unauthorized
        errorMessage = 'Xbox API request unauthorized. Check API key.';
      } else if (error.response.status === 403) { // Forbidden
        errorMessage = 'Access to Xbox API forbidden. The API key might not have the correct permissions or the user profile is private.';
      } else if (error.response.status === 404) { // Not Found
        errorMessage = 'Xbox user profile not found or a specific endpoint path was incorrect.';
      } else if (error.response.status === 429) { // Too Many Requests
        errorMessage = 'Too many requests to Xbox API. Please try again later.';
      }
      res.status(error.response.status).json({ error: errorMessage, details: errorDetails });
    } else if (error.request) {
      // Axios error where the request was made but no response was received
      logger.error(`${errorMessage} No response received from xbl.io:`, {
        xuid,
        request: error.request,
      });
      errorMessage = 'Failed to fetch Xbox games. No response from xbl.io API.';
      res.status(503).json({ error: errorMessage }); // Service Unavailable
    } else {
      // Other errors (e.g., setup issues, network problems before request was made)
      logger.error(`${errorMessage} Error details:`, {
        xuid,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: errorMessage, details: { message: error.message } });
    }
  }
});

module.exports = router;
