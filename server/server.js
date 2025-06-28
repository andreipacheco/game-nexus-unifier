const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors'); // Import CORS
const path = require('path'); // Added for serving static files
const connectDB = require('./config/db');
const logger = require('./config/logger');

dotenv.config();
console.log('[DEBUG] server.js: dotenv.config() called.');

const determinedPort = process.env.PORT || 10000; // Define port before it's used by main() via IIFE

// Initialize DB and SteamAPI early
(async () => {
  try {
    console.log('[DEBUG] server.js: Calling connectDB() early.');
    await connectDB(); // Ensure DB is connected early
    console.log('[DEBUG] server.js: Calling initializeSteamAPI() early.');
    await initializeSteamAPI(); // Ensure SteamAPI is initialized early

    // After early initializations, call main() to start the server
    if (process.env.NODE_ENV !== 'test') {
      main();
    }
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
const defaultFrontendDevUrl = 'http://localhost:8080'; // For 'npm run dev'
const vitePreviewUrl = 'http://localhost:4173';      // For 'npm run preview'
const anotherLocalDevUrl = 'http://localhost:3000';   // Another you had

// Production URL from environment variables
const productionAppUrl = process.env.APP_BASE_URL;

const allowedOrigins = [];

if (process.env.NODE_ENV === 'production') {
  if (productionAppUrl) {
    allowedOrigins.push(productionAppUrl);
    logger.info(`CORS: Production mode. Allowing origin: ${productionAppUrl}`);
  } else {
    logger.warn('CORS: Production mode, but APP_BASE_URL is not set. Frontend may not connect.');
  }
} else {
  // Development or other environments
  allowedOrigins.push(defaultFrontendDevUrl);
  allowedOrigins.push(vitePreviewUrl);
  allowedOrigins.push(anotherLocalDevUrl);
  if (productionAppUrl) { // If APP_BASE_URL is set in dev (e.g., for testing prod config)
    allowedOrigins.push(productionAppUrl);
  }
  logger.info(`CORS: Development/other mode. Allowed origins: ${allowedOrigins.join(', ')}`);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no 'origin' (e.g., Postman, mobile apps, curl)
    // OR if the origin is in the allowed list.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const errorMsg = `CORS: Policy does not allow access from Origin '${origin}'. Allowed: ${allowedOrigins.join(', ')}`;
      logger.warn(errorMsg);
      callback(new Error(errorMsg)); // Pass an error to the callback
    }
  },
  credentials: true
}));
console.log(`[DEBUG] server.js: CORS configured. Effective allowed origins for current environment: ${allowedOrigins.join(', ')}`);

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

// API routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
console.log('[DEBUG] server.js: Auth routes mounted.');

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);
console.log('[DEBUG] server.js: User routes mounted.');

// Import steam routes
const steamRoutes = require('./routes/steam');
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

console.log('[DEBUG] server.js: Core API routes defined.');

// --- Static file serving and SPA fallback ---
// Serve static files from the React app build directory (e.g., CSS, JS, images)
// This should come AFTER API routes if API routes might have conflicting paths (e.g. /api/static/...),
// but typically API routes are namespaced like /api/, so placing static serving before SPA fallback is common.
app.use(express.static(path.join(__dirname, '..', 'dist')));
logger.info(`Configured to serve static files from ${path.join(__dirname, '..', 'dist')}`);
console.log(`[DEBUG] server.js: Static file middleware configured to serve from ../dist.`);

// The SPA fallback handler: for any request that doesn't match an API route or a static file,
// send back React's index.html file. This must be after API routes and static file serving.
app.get('*', (req, res) => {
  // Check if the request is likely for an API endpoint that was not found
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    // If it's an API/auth path not caught by specific route handlers, it's a 404 for an API endpoint.
    logger.warn(`404 - API/auth route not found: ${req.method} ${req.path}`);
    console.log(`[DEBUG] server.js: 404 - API/auth route ${req.path} not found by specific route handlers.`);
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  // For all other GET requests, assume it's a frontend route and serve index.html
  // This allows React Router to handle the client-side routing.
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error(`Error sending index.html for path ${req.path}:`, err);
      console.error(`[DEBUG] server.js: Error sending index.html for path ${req.path}:`, err);
      // Avoid sending another response if headers might have been partially sent.
      if (!res.headersSent) {
        res.status(500).send('Error serving frontend application.');
      }
    } else {
      logger.info(`SPA Fallback: Successfully served index.html for non-API/auth route: ${req.path}`);
      console.log(`[DEBUG] server.js: SPA Fallback: Successfully served index.html for non-API/auth route: ${req.path}`);
    }
  });
});
console.log('[DEBUG] server.js: SPA fallback route configured to serve index.html for client-side routing.');

// const determinedPort = process.env.PORT || 10000; // MOVED EARLIER: Use 10000 as default for Render

async function main() {
  console.log('[DEBUG] server.js: main() called. Entered main function.');
  logger.info('[DEBUG] server.js: Entered main function.');
  try {
    // connectDB() and initializeSteamAPI() are now called earlier, outside of main.

    // The OpenID client setup (using openid-client directly) has been removed.
    // Passport-steam now handles Steam OpenID.

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DEBUG] server.js: About to call app.listen on port ${determinedPort}.`);
      logger.info(`[DEBUG] server.js: About to call app.listen on port ${determinedPort}.`);
      app.listen(determinedPort, () => {
        logger.info(`Server listening at http://localhost:${determinedPort}`);
        console.log(`[DEBUG] server.js: Server is listening on port ${determinedPort}. Callback executed.`);
      });
    } else {
      console.log('[DEBUG] server.js: Skipping app.listen because NODE_ENV is "test".');
      logger.info('[DEBUG] server.js: Skipping app.listen because NODE_ENV is "test".');
    }
  } catch (error) {
    logger.error('Critical error during server startup sequence:', error);
    console.error('[DEBUG] server.js: Critical error during server startup sequence:', error);
    process.exit(1); // Exit if critical initializations fail
  }
}

// The call to main() has been moved into the IIFE for early initializations.

module.exports = app; // Export the configured app for testing
