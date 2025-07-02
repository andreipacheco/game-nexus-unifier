// server/routes/auth.js (VERSÃO DE TESTE SIMPLIFICADA)
const express = require('express');
const router = express.Router();
const logger = require('../config/logger'); // Supondo que isso funcione

logger.info('--- [server/routes/auth.js] SIMPLIFIED TEST VERSION LOADED ---');

router.get('/test-auth', (req, res) => {
  logger.info('--- GET /auth/test-auth endpoint hit! ---');
  res.status(200).send('Auth test route is working!');
});

/*
const passport = require('passport');
const User = require('../models/User'); // Import User model

// Note: The initializeAuthSteamAPI and related 'steam' variable are removed
// as passport-steam strategy in passportConfig.js handles Steam API interaction.

// --- Email/Password Authentication Routes ---

// POST /auth/register - User Registration
router.post('/register', async (req, res, next) => {
  logger.info('--- Attempting POST /auth/register ---');
  logger.info('Request Body for register:', req.body);

  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  try {
    const lowercasedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: lowercasedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }

    const newUser = new User({
      name: name || '', // Default to empty string if name is not provided
      email: lowercasedEmail,
      password: password, // Password will be hashed by pre-save hook in User model
    });

    await newUser.save();
    logger.info(`New user registered: ${newUser.email}, ID: ${newUser._id}`);

    // Log in the user automatically after registration
    req.login(newUser, (err) => {
      logger.info('--- req.login Callback Invoked (after register) ---');
      if (err) {
        logger.error('Error logging in user after registration:', { userId: newUser._id, error: err });
        return next(err); // Pass error to error handler
      }
      logger.info(`User ${newUser.email} logged in successfully after registration.`);
      const { password, ...userData } = newUser.toObject(); // Exclude password
      return res.status(201).json({ message: 'Registration successful. User logged in.', user: userData });
    });

  } catch (error) {
    logger.error('Error during user registration:', { error: error.message, stack: error.stack });
    // Check for duplicate key error (though findOne should catch it, this is a fallback)
    if (error.code === 11000) { // MongoDB duplicate key error
        return res.status(409).json({ message: 'User already exists with this email.' });
    }
    return res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /auth/login - User Login
router.post('/login', (req, res, next) => {
  logger.info('--- Attempting POST /auth/login ---'); // Log de entrada na rota
  logger.info('Request Body for login:', req.body); // Log para ver o corpo da requisição

  passport.authenticate('local', (err, user, info) => {
    logger.info('--- Passport Authenticate Callback Invoked ---'); // Log para ver se o callback é chamado
    logger.info('Passport authenticate values:', { err, user: user ? user.email : null, info });

    if (err) {
      logger.error('Error during local authentication:', { error: err });
      return next(err);
    }
    if (!user) {
      logger.warn('Local authentication failed (passport.authenticate callback):', { message: info ? info.message : 'No user object' });
      return res.status(401).json({ message: info && info.message ? info.message : 'Login failed. Invalid credentials.' });
    }
    req.login(user, (loginErr) => { // Changed err to loginErr to avoid conflict if err from authenticate is in scope
      logger.info('--- req.login Callback Invoked ---'); // Log para ver se o req.login callback é chamado
      if (loginErr) {
        logger.error('Error logging in user after local authentication (req.login callback):', { userId: user._id, error: loginErr });
        return next(loginErr);
      }
      logger.info(`User ${user.email} logged in successfully via local strategy (req.login success).`);
      const { password, ...userData } = user.toObject(); // Exclude password
      return res.json({ message: 'Login successful', user: userData });
    });
  })(req, res, next);
});


// --- Google Authentication Routes ---

// Initiates Google authentication flow
router.get('/google', (req, res, next) => {
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';
    const NETLIFY_URL = process.env.URL;
    const APP_BASE_URL_FROM_ENV = process.env.APP_BASE_URL;
    const FRONTEND_DEV_URL = 'http://localhost:8080';
    let effectiveAppBaseUrl;

    if (IS_PRODUCTION && NETLIFY_URL) effectiveAppBaseUrl = NETLIFY_URL;
    else if (IS_PRODUCTION && APP_BASE_URL_FROM_ENV) effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV;
    else if (!IS_PRODUCTION) effectiveAppBaseUrl = FRONTEND_DEV_URL;
    else effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV || '/';

    passport.authenticate('google', {
        scope: ['profile', 'email'], // Request access to profile and email
        // failureRedirect can be set here if needed, for errors during the *initial* redirect to Google.
        // For example, if the strategy itself is misconfigured for the initiation part.
        // However, most failures occur on the callback.
        // If a failureRedirect is used here, it should also use effectiveAppBaseUrl.
        // For now, assuming failures are primarily handled at callback, or passport handles initial errors.
    })(req, res, next);
});

// Handles the callback from Google after authentication attempt
router.get('/google/callback', (req, res, next) => {
    const IS_PRODUCTION_CB = process.env.NODE_ENV === 'production';
    const NETLIFY_URL_CB = process.env.URL;
    const APP_BASE_URL_FROM_ENV_CB = process.env.APP_BASE_URL;
    const FRONTEND_DEV_URL_CB = 'http://localhost:8080';
    let effectiveAppBaseUrlCb; // Base URL for failure redirects from this callback handler

    if (IS_PRODUCTION_CB && NETLIFY_URL_CB) effectiveAppBaseUrlCb = NETLIFY_URL_CB;
    else if (IS_PRODUCTION_CB && APP_BASE_URL_FROM_ENV_CB) effectiveAppBaseUrlCb = APP_BASE_URL_FROM_ENV_CB;
    else if (!IS_PRODUCTION_CB) effectiveAppBaseUrlCb = FRONTEND_DEV_URL_CB;
    else effectiveAppBaseUrlCb = APP_BASE_URL_FROM_ENV_CB || '/';

    passport.authenticate('google', {
        failureRedirect: `${effectiveAppBaseUrlCb}/login?error=google_auth_failed_callback`, // Dynamic failure redirect
        failureMessage: true
    }, (err, user, info) => { // Custom callback for passport.authenticate
        if (err) {
            logger.error('Error in Google callback from passport.authenticate', { error: err, info });
            // Ensure this redirect also uses the correct base URL
            return res.redirect(`${effectiveAppBaseUrlCb}/login?error=google_auth_exception`);
        }
        if (!user) {
            logger.warn('Google authentication failed, no user returned.', { info });
            const failureQueryParam = (info && info.message ? encodeURIComponent(info.message) : 'google_auth_failed_nouser');
            // Ensure this redirect also uses the correct base URL
            return res.redirect(`${effectiveAppBaseUrlCb}/login?error=${failureQueryParam}`);
        }
        // User is authenticated, log them in
        req.login(user, (loginErr) => {
            if (loginErr) {
                logger.error('Error logging in user after Google auth:', { userId: user.id, error: loginErr });
                // Ensure this redirect also uses the correct base URL
                return res.redirect(`${effectiveAppBaseUrlCb}/login?error=google_login_error`);
            }
            // Successfully logged in. Now determine redirect for success.
            logger.info(`User authenticated and logged in via Google: ${user.id || user.googleId || user.email}`);

            // Base URL for SUCCESS redirect (to dashboard) - this logic is already updated from previous steps
            const IS_PRODUCTION_SUCCESS = process.env.NODE_ENV === 'production';
            const NETLIFY_URL_SUCCESS = process.env.URL;
            const APP_BASE_URL_FROM_ENV_SUCCESS = process.env.APP_BASE_URL;
            const FRONTEND_DEV_URL_SUCCESS = 'http://localhost:8080';
            let effectiveAppBaseUrlSuccess;

            if (IS_PRODUCTION_SUCCESS && NETLIFY_URL_SUCCESS) effectiveAppBaseUrlSuccess = NETLIFY_URL_SUCCESS;
            else if (IS_PRODUCTION_SUCCESS && APP_BASE_URL_FROM_ENV_SUCCESS) effectiveAppBaseUrlSuccess = APP_BASE_URL_FROM_ENV_SUCCESS;
            else if (!IS_PRODUCTION_SUCCESS) effectiveAppBaseUrlSuccess = FRONTEND_DEV_URL_SUCCESS;
            else effectiveAppBaseUrlSuccess = APP_BASE_URL_FROM_ENV_SUCCESS || '/';

            const redirectTo = `${effectiveAppBaseUrlSuccess}/dashboard?google_login_success=true`;
            logger.info(`Redirecting to: ${redirectTo}`);
            return res.redirect(redirectTo);
        });
    })(req, res, next); // Invoke passport.authenticate middleware
});

// --- Steam Authentication Routes ---

// Initiates the Steam authentication flow using Passport
router.get('/steam', (req, res, next) => {
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';
    const NETLIFY_URL = process.env.URL;
    const APP_BASE_URL_FROM_ENV = process.env.APP_BASE_URL;
    const FRONTEND_DEV_URL = 'http://localhost:8080';
    let effectiveAppBaseUrl;

    if (IS_PRODUCTION && NETLIFY_URL) effectiveAppBaseUrl = NETLIFY_URL;
    else if (IS_PRODUCTION && APP_BASE_URL_FROM_ENV) effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV;
    else if (!IS_PRODUCTION) effectiveAppBaseUrl = FRONTEND_DEV_URL;
    else effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV || '/';

    passport.authenticate('steam', {
        failureRedirect: `${effectiveAppBaseUrl}/login?error=steam_auth_init_failed`
    })(req, res, next);
});

// Handles the callback from Steam after authentication attempt
router.get('/steam/return', (req, res, next) => {
    const IS_PRODUCTION_CB = process.env.NODE_ENV === 'production';
    const NETLIFY_URL_CB = process.env.URL;
    const APP_BASE_URL_FROM_ENV_CB = process.env.APP_BASE_URL;
    const FRONTEND_DEV_URL_CB = 'http://localhost:8080';
    let effectiveAppBaseUrlCb; // Base URL for failure redirects from this callback handler

    if (IS_PRODUCTION_CB && NETLIFY_URL_CB) effectiveAppBaseUrlCb = NETLIFY_URL_CB;
    else if (IS_PRODUCTION_CB && APP_BASE_URL_FROM_ENV_CB) effectiveAppBaseUrlCb = APP_BASE_URL_FROM_ENV_CB;
    else if (!IS_PRODUCTION_CB) effectiveAppBaseUrlCb = FRONTEND_DEV_URL_CB;
    else effectiveAppBaseUrlCb = APP_BASE_URL_FROM_ENV_CB || '/';

    passport.authenticate('steam', {
        failureRedirect: `${effectiveAppBaseUrlCb}/login?error=steam_auth_callback_failed`, // Dynamic failure redirect
        failureMessage: true
    }, (err, user, info) => { // Custom callback for passport.authenticate
        if (err) {
            logger.error('Error in Steam callback from passport.authenticate', { error: err, info });
            return res.redirect(`${effectiveAppBaseUrlCb}/login?error=steam_auth_exception`);
        }
        if (!user) {
            logger.warn('Steam authentication failed, no user returned.', { info });
            const failureQueryParam = (info && info.message ? encodeURIComponent(info.message) : 'steam_auth_failed_nouser');
            return res.redirect(`${effectiveAppBaseUrlCb}/login?error=${failureQueryParam}`);
        }
        // User is authenticated, log them in
        req.login(user, (loginErr) => {
            if (loginErr) {
                logger.error('Error logging in user after Steam auth:', { userId: user.steamId, error: loginErr });
                return res.redirect(`${effectiveAppBaseUrlCb}/login?error=steam_login_error`);
            }
            // Successfully logged in. Now determine redirect for success.
            logger.info(`Steam authentication successful for user: ${user.steamId} - ${user.personaName}. Redirecting to dashboard.`);

            // Base URL for SUCCESS redirect (to dashboard) - this logic is already updated from previous steps
            const IS_PRODUCTION_SUCCESS = process.env.NODE_ENV === 'production';
            const NETLIFY_URL_SUCCESS = process.env.URL;
            const APP_BASE_URL_FROM_ENV_SUCCESS = process.env.APP_BASE_URL;
            const FRONTEND_DEV_URL_SUCCESS = 'http://localhost:8080';
            let effectiveAppBaseUrlSuccess;

            if (IS_PRODUCTION_SUCCESS && NETLIFY_URL_SUCCESS) effectiveAppBaseUrlSuccess = NETLIFY_URL_SUCCESS;
            else if (IS_PRODUCTION_SUCCESS && APP_BASE_URL_FROM_ENV_SUCCESS) effectiveAppBaseUrlSuccess = APP_BASE_URL_FROM_ENV_SUCCESS;
            else if (!IS_PRODUCTION_SUCCESS) effectiveAppBaseUrlSuccess = FRONTEND_DEV_URL_SUCCESS;
            else effectiveAppBaseUrlSuccess = APP_BASE_URL_FROM_ENV_SUCCESS || '/';

            const redirectTo = `${effectiveAppBaseUrlSuccess}/dashboard?steam_login_success=true&steamid=${user.steamId}`;
            logger.info(`Redirecting to: ${redirectTo}`);
            return res.redirect(redirectTo);
        });
    })(req, res, next); // Invoke passport.authenticate middleware
});

// --- General Logout Route ---

// Logout route
router.get('/logout', async (req, res, next) => { // Made async
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';
    const NETLIFY_URL = process.env.URL; // Specific to Netlify's build/runtime environment
    const APP_BASE_URL_FROM_ENV = process.env.APP_BASE_URL;
    const FRONTEND_DEV_URL = 'http://localhost:8080'; // Vite default

    let effectiveAppBaseUrl;
    if (IS_PRODUCTION && NETLIFY_URL) {
        effectiveAppBaseUrl = NETLIFY_URL; // Netlify's deployed URL
    } else if (IS_PRODUCTION && APP_BASE_URL_FROM_ENV) {
        // Production but not on Netlify (e.g., other hosting)
        effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV;
    } else if (!IS_PRODUCTION) {
        // Local development
        effectiveAppBaseUrl = FRONTEND_DEV_URL;
    } else {
        // Fallback for production if nothing else is set (less ideal but ensures a base)
        effectiveAppBaseUrl = APP_BASE_URL_FROM_ENV || '/';
    }

    if (req.user) {
        try {
            req.user.lastLogoutAt = new Date();
            await req.user.save();
            const userIdForLog = req.user.steamId || req.user.googleId || req.user.email || req.user.id;
            logger.info(`Updated lastLogoutAt for user: ${userIdForLog}`);
        } catch (dbError) {
            logger.error('Failed to update lastLogoutAt on logout', { userId: req.user.id, error: dbError });
        }
    }

    req.logout(function(err) {
        if (err) {
            logger.error('Logout error', { error: err });
            return res.redirect(`${effectiveAppBaseUrl}/login?error=logout_failed`);
        }
        req.session.destroy(err => {
            if (err) {
                logger.error('Session destruction error during logout', { error: err });
                res.clearCookie('connect.sid');
                return res.redirect(`${effectiveAppBaseUrl}/login?error=session_destroy_failed`);
            }
            res.clearCookie('connect.sid');
            logger.info('User logged out successfully, session destroyed. Redirecting to home.');
            res.redirect(effectiveAppBaseUrl); // Redirect to home/login page
        });
    });
});

// --- Xbox Connection Route ---
const axios = require('axios'); // For calling Xbox API
const XBL_API_KEY = process.env.XBL_API_KEY;
const XBL_API_BASE_URL = 'https://xbl.io/api/v2';

router.post('/xbox/connect', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    const { xuid } = req.body;
    if (!xuid) {
        return res.status(400).json({ message: 'Xbox User ID (XUID) is required.' });
    }

    try {
        logger.info(`Attempting to connect Xbox account for user ${req.user.id} with XUID ${xuid}.`);

        // Optional: Verify XUID and get profile details from Xbox Live API
        let gamertag = req.body.gamertag; // Use provided gamertag if any

        if (XBL_API_KEY) {
            try {
                const profileUrl = `${XBL_API_BASE_URL}/account/${xuid}`;
                logger.debug(`Fetching Xbox profile from: ${profileUrl}`);
                const response = await axios.get(profileUrl, {
                    headers: {
                        'X-Authorization': XBL_API_KEY,
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US'
                    }
                });

                if (response.data && response.data.profileUsers && response.data.profileUsers.length > 0) {
                    const profile = response.data.profileUsers[0];
                    if (profile.settings) {
                        const gamertagSetting = profile.settings.find(s => s.id === 'Gamertag');
                        if (gamertagSetting) {
                            gamertag = gamertagSetting.value;
                            logger.info(`Successfully fetched Xbox gamertag '${gamertag}' for XUID ${xuid}.`);
                        }
                    }
                } else {
                    logger.warn(`Could not verify XUID ${xuid} or fetch gamertag. Response was not as expected.`);
                    // Decide if this is a hard failure or proceed with user-provided/no gamertag
                    // For now, let's proceed but log it.
                }
            } catch (apiError) {
                logger.error(`Error calling Xbox API to verify XUID ${xuid}:`, {
                    message: apiError.message,
                    response: apiError.response ? { status: apiError.response.status, data: apiError.response.data } : null
                });
                // If API call fails (e.g. invalid XUID, API key issue), return an error
                let friendlyMessage = 'Failed to verify Xbox User ID. Please ensure it is correct.';
                if (apiError.response && apiError.response.status === 404) {
                    friendlyMessage = 'Xbox User ID (XUID) not found. Please check and try again.';
                } else if (apiError.response && apiError.response.status === 401) {
                    friendlyMessage = 'Xbox API request unauthorized. Server configuration issue.';
                }
                return res.status(apiError.response?.status || 500).json({ message: friendlyMessage });
            }
        } else {
            logger.warn('XBL_API_KEY not set. Proceeding without Xbox profile verification/gamertag fetch.');
            if (!gamertag) {
                // If no API key and no gamertag provided, this is less ideal.
                // We could make gamertag also required if API key is missing, or use XUID as placeholder.
                logger.info(`No XBL_API_KEY and no gamertag provided for XUID ${xuid}. Gamertag will be empty.`);
            }
        }

        // Check if this XUID is already linked to another user
        const existingUserWithXuid = await User.findOne({ xboxUserId: xuid, _id: { $ne: req.user.id } });
        if (existingUserWithXuid) {
          logger.warn(`User ${req.user.id} attempting to connect XUID ${xuid} that is already in use by user ${existingUserWithXuid._id}.`);
          return res.status(409).json({ message: 'This Xbox account (XUID) is already linked to a different user account.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                xboxUserId: xuid,
                xboxGamertag: gamertag || '', // Store fetched/provided gamertag or empty string
            },
            { new: true }
        ).select('-password -npsso'); // Exclude sensitive fields

        if (!updatedUser) {
            logger.warn(`User not found during Xbox connect process for ID: ${req.user.id}`);
            return res.status(404).json({ message: 'User not found' });
        }

        logger.info(`Xbox account ${xuid} (Gamertag: ${gamertag}) successfully connected for user ${req.user.id}.`);
        const { password, ...userData } = updatedUser.toObject(); // Exclude password for response
        res.json({
            message: 'Xbox account connected successfully.',
            user: userData
        });

    } catch (error) {
        logger.error(`Error connecting Xbox account for user ${req.user.id} with XUID ${xuid}:`, error);
        res.status(500).json({ message: 'Server error during Xbox account connection.' });
    }
});
*/
module.exports = router;
