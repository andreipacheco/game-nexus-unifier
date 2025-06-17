const express = require('express');
const router = express.Router();
const passport = require('passport'); // Require Passport
const logger = require('../config/logger'); // Import logger
// User model will be used by passportConfig, not directly here for login/callback

// Note: The initializeAuthSteamAPI and related 'steam' variable are removed
// as passport-steam strategy in passportConfig.js handles Steam API interaction.

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
