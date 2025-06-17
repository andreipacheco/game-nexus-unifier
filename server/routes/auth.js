const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User'); // Import User model
const logger = require('../config/logger');

// Note: The initializeAuthSteamAPI and related 'steam' variable are removed
// as passport-steam strategy in passportConfig.js handles Steam API interaction.

// --- Email/Password Authentication Routes ---

// POST /auth/register - User Registration
router.post('/register', async (req, res, next) => {
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
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      logger.error('Error during local authentication:', { error: err });
      return next(err);
    }
    if (!user) {
      logger.warn('Local authentication failed:', { message: info ? info.message : 'No user object' });
      return res.status(401).json({ message: info && info.message ? info.message : 'Login failed. Invalid credentials.' });
    }
    req.login(user, (err) => {
      if (err) {
        logger.error('Error logging in user after local authentication:', { userId: user._id, error: err });
        return next(err);
      }
      logger.info(`User ${user.email} logged in successfully via local strategy.`);
      const { password, ...userData } = user.toObject(); // Exclude password
      return res.json({ message: 'Login successful', user: userData });
    });
  })(req, res, next);
});


// --- Google Authentication Routes ---

// Initiates Google authentication flow
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'] // Request access to profile and email
}));

// Handles the callback from Google after authentication attempt
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.APP_BASE_URL || '/'}/login?error=google_auth_failed`, // Redirect on failure
        failureMessage: true // Store failure message in req.session.messages
    }),
    (req, res) => {
        // Successful authentication. req.user is populated by Passport's verify callback.
        logger.info(`User authenticated via Google: ${req.user ? (req.user.id || req.user.googleId || req.user.email) : 'No user object found after auth'}`);
        // Be cautious logging entire session in production due to sensitive data.
        // For debugging, this can be very helpful.
        if (req.session) {
            logger.info(`Session details after Google auth: ${JSON.stringify(req.session, null, 2)}`);
        } else {
            logger.warn('No session object found on req after Google auth.');
        }
        logger.info(`req.user details after Google auth: ${JSON.stringify(req.user, null, 2)}`);

        // Redirect to frontend dashboard
        const redirectTo = `${process.env.APP_BASE_URL || '/'}/dashboard?google_login_success=true`;
        logger.info(`Redirecting to: ${redirectTo}`);
        res.redirect(redirectTo);
    }
);

// --- Steam Authentication Routes ---

// Initiates the Steam authentication flow using Passport
// The 'steam' string refers to the strategy name defined in passportConfig.js
// If passport.use('steam', new SteamStrategy(...)) was used, then 'steam' is correct.
// If passport.use(new SteamStrategy(...)) was used (no name given), Passport defaults to 'openid'
// for OpenID based strategies, but passport-steam usually registers as 'steam'.
router.get('/steam', passport.authenticate('steam', {
    failureRedirect: `${process.env.APP_BASE_URL || '/'}/login?error=steam_auth_init_failed` // Redirect to a login page with error
}));

// Handles the callback from Steam after authentication attempt
router.get('/steam/return',
    passport.authenticate('steam', {
        failureRedirect: `${process.env.APP_BASE_URL || '/'}/login?error=steam_auth_callback_failed`, // Redirect on failure
        failureMessage: true
    }),
    (req, res) => {
        // Successful authentication. req.user is populated by Passport's verify callback.
        // The verify callback in passportConfig.js already handles User.findOrCreate/update.
        logger.info(`Steam authentication successful for user: ${req.user.steamId} - ${req.user.personaName}. Redirecting to dashboard.`);

        // Redirect to frontend dashboard, pass necessary info if needed (or rely on session)
        // Ensure APP_BASE_URL is defined in your .env
        const redirectTo = `${process.env.APP_BASE_URL || '/'}/dashboard?steam_login_success=true&steamid=${req.user.steamId}`;
        res.redirect(redirectTo);
    }
);

// --- General Logout Route ---

// Logout route
router.get('/logout', async (req, res, next) => { // Made async
    if (req.user) {
        try {
            // Assuming req.user is the Mongoose User document from deserializeUser.
            req.user.lastLogoutAt = new Date();
            await req.user.save();
            const userIdForLog = req.user.steamId || req.user.googleId || req.user.email || req.user.id;
            logger.info(`Updated lastLogoutAt for user: ${userIdForLog}`);
        } catch (dbError) {
            logger.error('Failed to update lastLogoutAt on logout', { userId: req.user.id, error: dbError });
            // This error should not prevent logout. Just log it.
        }
    }

    req.logout(function(err) {
        if (err) {
            logger.error('Logout error', { error: err });
            // Redirect to an error page or send an error response
            return res.redirect(`${process.env.APP_BASE_URL || '/'}/login?error=logout_failed`);
        }
        req.session.destroy(err => {
            if (err) {
                logger.error('Session destruction error during logout', { error: err });
                res.clearCookie('connect.sid'); // Default session cookie name
                return res.redirect(`${process.env.APP_BASE_URL || '/'}/login?error=session_destroy_failed`);
            }
            res.clearCookie('connect.sid'); // Ensure cookie is cleared
            logger.info('User logged out successfully, session destroyed. Redirecting to home.');
            res.redirect(process.env.APP_BASE_URL || '/'); // Redirect to home/login page
        });
    });
});

module.exports = router;
