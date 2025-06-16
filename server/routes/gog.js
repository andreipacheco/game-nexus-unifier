const express = require('express');
const axios = require('axios');
const logger = require('../config/logger'); // Corrected logger path

const router = express.Router();

router.get('/user/:gogUserId/games', async (req, res) => {
  const { gogUserId } = req.params;
  logger.info(`Fetching GOG games for user ${gogUserId}`);

  try {
    // Construct GOG API URL
    const apiUrl = 'https://embed.gog.com/user/data/games';
    logger.info(`Calling GOG API: ${apiUrl}`);

    const response = await axios.get(apiUrl);

    if (response.data && response.data.games) {
      logger.info(`Received ${response.data.games.length} games from GOG API for user ${gogUserId}`);
      const transformedGames = response.data.games.map(game => ({
        appID: game.id,
        name: game.title,
        playtimeForever: 0, // GOG API might not provide this
        imgIconURL: game.image ? `https:${game.image}_196.jpg` : '', // Construct full URL
        achievements: { unlocked: 0, total: 0 }, // GOG API might not provide this
      }));
      res.json(transformedGames);
    } else {
      logger.warn(`No games data found in GOG API response for user ${gogUserId}`);
      res.status(404).json({ message: 'No games found for this GOG user or API structure changed.' });
    }
  } catch (error) {
    logger.error(`Error fetching GOG games for user ${gogUserId}: ${error.message}`);
    if (error.response) {
      logger.error(`GOG API response error: Status ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      res.status(error.response.status).json({ message: 'Error fetching data from GOG API.', details: error.response.data });
    } else if (error.request) {
      logger.error('GOG API no response received');
      res.status(503).json({ message: 'No response from GOG API.' });
    } else {
      res.status(500).json({ message: 'Internal server error while fetching GOG games.' });
    }
  }
});

module.exports = router;
