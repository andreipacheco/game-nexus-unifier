const express = require('express');
const dotenv = require('dotenv');
const SteamAPI = require('steamapi');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize SteamAPI with your API key
const steam = new SteamAPI(process.env.STEAM_API_KEY);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Endpoint to fetch user data
app.get('/api/steam/user/:steamid', async (req, res) => {
  try {
    const steamID = req.params.steamid;
    const summary = await steam.getUserSummary(steamID);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data from Steam API' });
  }
});

// Endpoint to fetch user's owned games
app.get('/api/steam/user/:steamid/games', async (req, res) => {
  try {
    const steamID = req.params.steamid;
    const games = await steam.getUserOwnedGames(steamID);
    res.json(games);
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json({ error: 'Failed to fetch user games from Steam API' });
  }
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

module.exports = app; // Export app for testing
