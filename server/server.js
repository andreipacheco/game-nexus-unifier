const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors'); // Import CORS
const connectDB = require('./config/db');
const logger = require('./config/logger');

dotenv.config();
console.log('[DEBUG] server.js: dotenv.config() called.');

// Initialize DB and SteamAPI early
(async () => {
  try {
    console.log('[DEBUG] server.js: Calling connectDB() early.');
    await connectDB(); // Ensure DB is connected early
    console.log('[DEBUG] server.js: Calling initializeSteamAPI() early.');
    await initializeSteamAPI(); // Ensure SteamAPI is initialized early
  } catch (error) {
    logger.error('Critical error during early initialization sequence:', error);
    console.error('[DEBUG] server.js: Critical error during early initialization sequence:', error);
    process.exit(1); // Exit if critical initializations fail
  }
})();

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

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));
console.log(`[DEBUG] server.js: CORS enabled for origin: ${frontendUrl}`);

// Request Logging Middleware (add this before session or just after)
app.use((req, res, next) => {
  // Log specific paths or all paths if needed for debugging
  if (req.path.includes('/api/user/me') || req.path.includes('/auth/')) {
    logger.info(`Incoming Request: ${req.method} ${req.path}`);
    // Safely stringify session and user to avoid issues with circular refs or large objects in logs
    let sessionDetails = 'No session';
    if (req.session) {
      try {
        sessionDetails = JSON.stringify(req.session, (key, value) => {
          // Could filter or shorten parts of the session if too verbose
          if (key === 'cookie') return '[Cookie Object]'; // Example: avoid logging full cookie details
          return value;
        }, 2);
      } catch (e) {
        sessionDetails = 'Error stringifying session';
      }
    }
    logger.info(`  req.session: ${sessionDetails}`);

    let userDetails = 'No user from session';
    if (req.user) {
        try {
            userDetails = JSON.stringify(req.user, null, 2);
        } catch(e) {
            userDetails = 'Error stringifying user';
        }
    }
    logger.info(`  req.user: ${userDetails}`);
    logger.info(`  Origin Header: ${req.headers.origin || 'N/A'}`);
    logger.info(`  Referer Header: ${req.headers.referer || 'N/A'}`);
    // Logging req.cookies would require cookie-parser middleware if not already handled by another middleware
    // logger.info(`  Cookies: ${JSON.stringify(req.cookies)}`);
  }
  next();
});

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

// Import steam routes
const steamRoutes = require('./routes/steam');

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

// Comment out or remove existing Steam games route if it conflicts
// app.get('/api/steam/user/:steamid/games', async (req, res) => {
//   if (!steam) {
//     return res.status(503).json({ error: 'SteamAPI service not available or not initialized.' });
//   }
//   try {
//     const steamID = req.params.steamid;
//     const games = await steam.getUserOwnedGames(steamID);
//     res.json(games);
//   } catch (error) {
//     logger.error('Error fetching Steam user games for steamid %s:', req.params.steamid, error);
//     res.status(500).json({ error: 'Failed to fetch user games from Steam API' });
//   }
// });

// Use steam routes
app.use('/api/steam', steamRoutes);
console.log('[DEBUG] server.js: Steam routes mounted.');

// Import and use GOG routes
const gogRoutes = require('./routes/gog');
app.use('/api/gog', gogRoutes);
console.log('[DEBUG] server.js: GOG routes mounted.');

// Import and use Xbox routes
const xboxRoutes = require('./routes/xbox');
app.use('/api/xbox', xboxRoutes);
logger.info('Xbox routes mounted under /api/xbox.');
console.log('[DEBUG] server.js: Xbox routes mounted.');

// Import and use PSN routes
const psnRoutes = require('./routes/psn');
app.use('/api/psn', psnRoutes);
logger.info('PSN routes mounted under /api/psn.');
console.log('[DEBUG] server.js: PSN routes mounted.');

console.log('[DEBUG] server.js: Core routes defined.');


async function main() {
  console.log('[DEBUG] server.js: main() called.');
  try {
    // connectDB() and initializeSteamAPI() are now called earlier, outside of main.

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
