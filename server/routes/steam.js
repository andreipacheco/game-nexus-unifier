const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const axios = require('axios'); // Using axios for HTTP requests
const SteamGame = require('../models/SteamGame'); // Import the SteamGame model

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Ensure STEAM_API_KEY is loaded (typically from .env file)
const STEAM_API_KEY = process.env.STEAM_API_KEY;

if (!STEAM_API_KEY) {
  logger.error('STEAM_API_KEY is not defined in environment variables. Steam API calls will fail.');
}

// GET /api/steam/user/:steamId/games - Fetches user's owned games from Steam
router.get('/user/:steamId/games', async (req, res) => {
  const { steamId } = req.params;

  if (!STEAM_API_KEY) {
    return res.status(500).json({ error: 'Steam API key not configured on server.' });
  }

  if (!steamId) {
    return res.status(400).json({ error: 'Steam ID is required.' });
  }

  // --- MongoDB Cache Check ---
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Fetch games updated in the last 24 hours, or games that have never been updated (for initial fetch)
    // This also implies that if a game was fetched but had no achievements (default values),
    // and lastUpdated is old, it will be re-fetched.
    const dbGames = await SteamGame.find({
      steamId: steamId,
      lastUpdated: { $gte: twentyFourHoursAgo }
    }).sort({ name: 1 }); // Optionally sort by name

    if (dbGames.length > 0) {
      logger.info(`Serving ${dbGames.length} games from cache for steamId: ${steamId}`);
      return res.json(dbGames.map(game => ({
        appID: game.appId, // Ensure consistent output format
        name: game.name,
        playtimeForever: game.playtimeForever,
        imgIconURL: game.imgIconURL,
        imgLogoURL: game.imgLogoURL,
        achievements: game.achievements,
        // lastUpdated: game.lastUpdated // Optionally include for debugging
      })));
    }
    logger.info(`No fresh games in cache for steamId: ${steamId}. Fetching from Steam API.`);
  } catch (dbError) {
    logger.error('Error fetching games from MongoDB cache:', {
      steamId,
      errorMessage: dbError.message,
      errorStack: dbError.stack,
    });
    // Do not return yet, proceed to fetch from Steam API as a fallback
  }
  // --- End MongoDB Cache Check ---

  const ownedGamesApiUrl = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/`;

  try {
    logger.info(`Fetching Steam games from API for steamId: ${steamId}`);
    const ownedGamesResponse = await axios.get(ownedGamesApiUrl, {
      params: {
        key: STEAM_API_KEY,
        steamid: steamId,
        format: 'json',
        include_appinfo: true, // Include game name, icon, logo
        include_played_free_games: true // Optionally include free games played
      }
    });

    let gamesWithDetails = [];
    if (ownedGamesResponse.data && ownedGamesResponse.data.response && ownedGamesResponse.data.response.games) {
      const ownedGames = ownedGamesResponse.data.response.games;
      logger.info(`Fetched ${ownedGames.length} owned games for steamId: ${steamId}. Now fetching achievements...`);

      for (const game of ownedGames) {
        let achievementsData = { unlocked: 0, total: 0 }; // Default
        try {
          const achievementsApiUrl = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/`;
          const achievementResponse = await axios.get(achievementsApiUrl, {
            params: {
              key: STEAM_API_KEY,
              steamid: steamId,
              appid: game.appid,
              // l: 'english' // Optional: if you need names/descriptions later
            }
          });

          if (achievementResponse.data && achievementResponse.data.playerstats && achievementResponse.data.playerstats.achievements) {
            const achievementsArray = achievementResponse.data.playerstats.achievements;
            achievementsData.unlocked = achievementsArray.filter(ach => ach.achieved).length;
            achievementsData.total = achievementsArray.length;
          } else if (achievementResponse.data && achievementResponse.data.playerstats && achievementResponse.data.playerstats.success === false && achievementResponse.data.playerstats.error) {
             // Game might not have achievements, or an error specific to this game's achievements
             logger.warn(`Could not retrieve achievements for game ${game.appid} (Steam error): ${achievementResponse.data.playerstats.error}`, { steamId });
          } else if (achievementResponse.data && achievementResponse.data.playerstats && !achievementResponse.data.playerstats.achievements) {
            // This case handles when playerstats object exists but achievements array is missing (e.g. game has no achievements setup)
            logger.info(`No achievements found for game ${game.appid} (playerstats present but no achievements array).`, { steamId });
          }
          // Add a small delay to avoid hitting API rate limits
          await delay(150); // e.g., 150ms delay between each achievement fetch
        } catch (achError) {
          logger.warn(`Failed to fetch achievements for game ${game.appid}: ${achError.message}`, {
            steamId,
            axiosErrorDetails: achError.response ? { status: achError.response.status, data: achError.response.data } : 'N/A'
          });
          // Fallback to default achievementsData is already in place
           await delay(50); // Shorter delay on error before next attempt/game
        }

        gamesWithDetails.push({
          appID: game.appid,
          name: game.name,
          playtimeForever: game.playtime_forever,
          imgIconURL: game.img_icon_url,
          imgLogoURL: game.img_logo_url,
          achievements: achievementsData
        });
      }
      logger.info(`Successfully processed achievements for ${ownedGames.length} games for steamId: ${steamId}`);

      // --- Save to MongoDB ---
      if (gamesWithDetails.length > 0) {
        logger.info(`Saving/updating ${gamesWithDetails.length} games to MongoDB for steamId: ${steamId}`);
        for (const gameDetail of gamesWithDetails) {
          const gameDataToSave = {
            steamId: steamId,
            appId: gameDetail.appID, // Make sure to use appID from the processed details
            name: gameDetail.name,
            playtimeForever: gameDetail.playtimeForever,
            imgIconURL: gameDetail.imgIconURL,
            imgLogoURL: gameDetail.imgLogoURL,
            achievements: gameDetail.achievements,
            lastUpdated: new Date()
          };

          try {
            await SteamGame.findOneAndUpdate(
              { steamId: steamId, appId: gameDetail.appID }, // query
              gameDataToSave, // document to insert or update
              { upsert: true, new: true, setDefaultsOnInsert: true } // options
            );
          } catch (dbSaveError) {
            logger.error(`Failed to save game ${gameDetail.appID} to MongoDB for steamId ${steamId}:`, {
              errorMessage: dbSaveError.message,
              errorStack: dbSaveError.stack,
              gameData: gameDataToSave // Log the data that failed to save
            });
            // Continue to save other games even if one fails
          }
        }
        logger.info(`Finished saving/updating games to MongoDB for steamId: ${steamId}`);
      }
      // --- End Save to MongoDB ---

      res.json(gamesWithDetails); // Return the fresh data from API

    } else if (ownedGamesResponse.data && ownedGamesResponse.data.response && ownedGamesResponse.data.response.game_count === 0) {
      logger.info(`No games found for steamId: ${steamId} or profile might be private.`);
      // Even if no games are found, we might want to "cache" this information,
      // e.g., by storing a record indicating the user has no games or the profile is private,
      // to avoid hitting the Steam API repeatedly for such cases.
      // For now, just return empty array. Consider this for future enhancement.
      res.json([]); // Return empty array if no games or profile private
    }
    else {
      // This case handles unexpected structure from Steam API or empty response
      logger.warn('Steam API response structure was not as expected or empty.', { steamId, responseData: ownedGamesResponse.data });
      // If response.data.response is empty (e.g. private profile), it returns {}
      // Check for this specific case.
      if (ownedGamesResponse.data && Object.keys(ownedGamesResponse.data.response).length === 0) {
        logger.info(`No games found for steamId: ${steamId} (profile might be private or no games).`);
        res.json([]);
      } else {
        throw new Error('Unexpected response structure from Steam API.');
      }
    }
  } catch (error) {
    logger.error('Error fetching Steam games (main GetOwnedGames call):', {
      steamId,
      errorMessage: error.message,
      errorStack: error.stack,
      axiosErrorDetails: error.response ? { status: error.response.status, data: error.response.data } : 'N/A'
    });
    // Check if the error is from Axios and has a response (e.g. 4xx, 5xx from Steam API)
    if (error.response) {
        // Forward appropriate status code if available, otherwise default to 500
        res.status(error.response.status || 500).json({
            error: 'Failed to fetch games from Steam (main GetOwnedGames call).',
            details: error.response.data
        });
    } else {
        // For other errors (network issues, timeouts, etc.)
        res.status(500).json({ error: 'Failed to fetch games from Steam (main GetOwnedGames call) due to a server-side or network error.' });
    }
  }
});

module.exports = router;
