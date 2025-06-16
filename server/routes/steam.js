const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const axios = require('axios'); // Using axios for HTTP requests

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

  const steamApiUrl = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/`;

  try {
    logger.info(`Fetching Steam games for steamId: ${steamId}`);
    const response = await axios.get(steamApiUrl, {
      params: {
        key: STEAM_API_KEY,
        steamid: steamId,
        format: 'json',
        include_appinfo: true, // Include game name, icon, logo
        include_played_free_games: true // Optionally include free games played
      }
    });

    if (response.data && response.data.response && response.data.response.games) {
      // The actual game data is in response.data.response.games
      // The frontend expects an array of games directly.
      // The Steam API returns games with appid, name, playtime_forever, img_icon_url, img_logo_url
      // Let's map them to what the frontend SteamGame interface might expect,
      // though the frontend will do its own transformation to the common Game type.
      const games = response.data.response.games.map(game => ({
        appID: game.appid, // Consistent with frontend 'SteamGame' interface
        name: game.name,
        playtimeForever: game.playtime_forever, // Consistent with frontend
        imgIconURL: game.img_icon_url, // Consistent with frontend
        imgLogoURL: game.img_logo_url // Optional, but good to pass if available
        // Add other fields if the Steam API provides more that are directly useful
      }));
      logger.info(`Successfully fetched ${games.length} games for steamId: ${steamId}`);
      res.json(games);
    } else if (response.data && response.data.response && response.data.response.game_count === 0) {
      logger.info(`No games found for steamId: ${steamId} or profile might be private.`);
      res.json([]); // Return empty array if no games or profile private
    }
    else {
      // This case handles unexpected structure from Steam API or empty response
      logger.warn('Steam API response structure was not as expected or empty.', { steamId, responseData: response.data });
      // If response.data.response is empty (e.g. private profile), it returns {}
      // Check for this specific case.
      if (response.data && Object.keys(response.data.response).length === 0) {
        logger.info(`No games found for steamId: ${steamId} (profile might be private or no games).`);
        res.json([]);
      } else {
        throw new Error('Unexpected response structure from Steam API.');
      }
    }
  } catch (error) {
    logger.error('Error fetching Steam games:', {
      steamId,
      errorMessage: error.message,
      errorStack: error.stack,
      axiosErrorDetails: error.response ? { status: error.response.status, data: error.response.data } : 'N/A'
    });
    // Check if the error is from Axios and has a response (e.g. 4xx, 5xx from Steam API)
    if (error.response) {
        // Forward appropriate status code if available, otherwise default to 500
        res.status(error.response.status || 500).json({
            error: 'Failed to fetch games from Steam.',
            details: error.response.data
        });
    } else {
        // For other errors (network issues, timeouts, etc.)
        res.status(500).json({ error: 'Failed to fetch games from Steam due to a server-side or network error.' });
    }
  }
});

module.exports = router;
