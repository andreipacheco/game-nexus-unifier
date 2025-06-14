const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session'); // Added
const passport = require('passport'); // Added
const connectDB = require('./config/db');
const logger = require('./config/logger');

dotenv.config();
console.log('[DEBUG] server.js: dotenv.config() called.');

let steam; // Will hold the SteamAPI instance for /api/steam/* routes

async function initializeSteamAPI() {
  console.log('[DEBUG] server.js: initializeSteamAPI() called.');
  try {
    console.log('[DEBUG] server.js: Attempting to import steamapi...');
    const steamapiModule = await import('steamapi');
    console.log('[DEBUG] server.js: steamapi imported successfully.');
    const SteamAPIConstructor = steamapiModule.default;
    if (!process.env.STEAM_API_KEY) {
      logger.warn('STEAM_API_KEY is not defined for main SteamAPI instance. /api/steam/* routes will fail.');
    }
    steam = new SteamAPIConstructor(process.env.STEAM_API_KEY);
    logger.info('Main SteamAPI initialized (for /api/steam/* routes).');
  } catch (err) {
    console.error('[DEBUG] server.js: Failed to initialize main SteamAPI:', err);
    logger.error('Failed to initialize main SteamAPI:', err);
    // Server will start, but /api/steam/* routes will be unavailable.
  }
}

const app = express();
console.log('[DEBUG] server.js: Express app created.');

// Middleware
app.use(express.json());
console.log('[DEBUG] server.js: express.json middleware applied.');

// Express session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key_12345', // Use env var
  resave: false,
  saveUninitialized: false, // Reverted to false
  // cookie: { secure: process.env.NODE_ENV === 'production' } // Recommended for HTTPS
}));
console.log('[DEBUG] server.js: express-session middleware applied with saveUninitialized: false.');

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
console.log('[DEBUG] server.js: Passport middleware initialized.');

// Configure Passport strategies
const configurePassport = require('./config/passportConfig'); // Added
configurePassport(passport); // Added

// Define Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
console.log('[DEBUG] server.js: Auth routes mounted.');

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);
console.log('[DEBUG] server.js: User routes mounted.');

const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Steam API proxy routes (dependent on `steam` instance)
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
console.log('[DEBUG] server.js: Core routes defined.');


async function main() {
  console.log('[DEBUG] server.js: main() called.');
  try {
    console.log('[DEBUG] server.js: Calling connectDB().');
    await connectDB(); // Ensure DB is connected

    console.log('[DEBUG] server.js: Calling initializeSteamAPI().');
    await initializeSteamAPI(); // Ensure SteamAPI (for /api/steam/*) is initialized

    // The OpenID client setup (using openid-client directly) has been removed.
    // Passport-steam now handles Steam OpenID.

    if (process.env.NODE_ENV !== 'test') {
      app.listen(port, () => {
        logger.info(`Server listening at http://localhost:${port}`);
      });
    }
  } catch (error) {
    logger.error('Critical error during server startup sequence:', error);
    console.error('[DEBUG] server.js: Critical error during server startup sequence:', error);
    process.exit(1); // Exit if critical initializations fail
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}

module.exports = app; // Export the configured app for testing
