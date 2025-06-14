const express = require('express');
const dotenv = require('dotenv');
// const SteamAPI = require('steamapi'); // To be dynamically imported
const connectDB = require('./config/db'); // Import connectDB
const logger = require('./config/logger'); // Import logger

// Load environment variables from .env file
dotenv.config();
console.log('[DEBUG] server.js: dotenv.config() called.'); // Basic console log

let steam; // Will hold the SteamAPI instance

async function initializeSteamAPI() {
  console.log('[DEBUG] server.js: initializeSteamAPI() called.'); // Basic console log
  try {
    console.log('[DEBUG] server.js: Attempting to import steamapi...'); // Basic console log
    const steamapiModule = await import('steamapi');
    console.log('[DEBUG] server.js: steamapi imported successfully.'); // Basic console log
    const SteamAPIConstructor = steamapiModule.default; // Assuming 'default' export
    if (!process.env.STEAM_API_KEY) {
      logger.warn('STEAM_API_KEY is not defined. Steam user data fetching via /api/steam/* will fail.');
    }
    steam = new SteamAPIConstructor(process.env.STEAM_API_KEY);
    logger.info('SteamAPI initialized for /api/steam/* routes.');
  } catch (err) {
    // Use console.error here as logger might not be ready or part of the problem
    console.error('[DEBUG] server.js: Failed to initialize SteamAPI for /api/steam/* routes:', err);
    logger.error('Failed to initialize SteamAPI for /api/steam/* routes:', err);
    // Server will start, but /api/steam/* routes will fail if steam is not initialized.
  }
}

// Connect to MongoDB
console.log('[DEBUG] server.js: Calling connectDB().'); // Basic console log
connectDB();

const app = express();
console.log('[DEBUG] server.js: Express app created.'); // Basic console log

// Middleware
app.use(express.json()); // For parsing application/json

// Define Routes
const authRoutes = require('./routes/auth'); // auth.js will need its own SteamAPI init or receive an instance
app.use('/auth', authRoutes);

const userRoutes = require('./routes/user'); // Import user routes
app.use('/api/user', userRoutes); // Mount user routes

const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Endpoint to fetch user data
app.get('/api/steam/user/:steamid', async (req, res) => {
  if (!steam) {
    return res.status(503).json({ error: 'SteamAPI service not available or not initialized.' });
  }
  try {
    const steamID = req.params.steamid;
    const summary = await steam.getUserSummary(steamID);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching Steam user data for steamid %s:', req.params.steamid, error);
    res.status(500).json({ error: 'Failed to fetch user data from Steam API' });
  }
});

// Endpoint to fetch user's owned games
app.get('/api/steam/user/:steamid/games', async (req, res) => {
  if (!steam) {
    return res.status(503).json({ error: 'SteamAPI service not available or not initialized.' });
  }
  try {
    const steamID = req.params.steamid;
    const games = await steam.getUserOwnedGames(steamID);
    res.json(games);
  } catch (error) {
    logger.error('Error fetching Steam user games for steamid %s:', req.params.steamid, error);
    res.status(500).json({ error: 'Failed to fetch user games from Steam API' });
  }
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeSteamAPI().then(() => { // Initialize SteamAPI before starting server for /api/steam/* routes
    app.listen(port, () => {
      logger.info(`Server listening at http://localhost:${port}`);
    });
  });
}

module.exports = app; // Export app for testing
