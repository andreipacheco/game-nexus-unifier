// ESM style imports, assuming server might move towards ESM or for consistency if other new files use it.
// If server remains strictly CommonJS, these would be `require`.
// However, given the previous ERR_REQUIRE_ESM issues, using `import` here might be problematic
// if this file is `require`d by `server.js` (a CJS module).
// For now, I will use CommonJS `require` to match `server.js` context and avoid new ESM issues.

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SteamStrategy = require('passport-steam').Strategy;
const User = require('../models/User'); // Adjusted path assuming User.js is in ../models/
const bcrypt = require('bcrypt'); // For password comparison
const logger = require('./logger'); // Adjusted path assuming logger.js is in the same dir (./logger)

// Determine if running in a production environment (Netlify sets NODE_ENV to 'production')
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Get the base URL
// Netlify provides process.env.URL as the canonical URL of the deployed site.
// process.env.DEPLOY_PRIME_URL is for deploy previews. Use URL for the main site.
// Fallback to your custom APP_BASE_URL if URL is not available (should not happen on Netlify).
// Then fallback to localhost for development.
let determinedAppBaseUrl;
if (IS_PRODUCTION) {
    determinedAppBaseUrl = process.env.URL || process.env.APP_BASE_URL;
} else {
    // For development, ensure this matches your backend's listening URL if different from frontend
    determinedAppBaseUrl = process.env.APP_BASE_URL || 'http://localhost:10000';
}

// If for some reason determinedAppBaseUrl is still not set, provide a final fallback.
const effectiveAppBaseUrl = determinedAppBaseUrl || 'http://localhost:10000';

// Log the determined URL for debugging during startup (check Netlify function logs)
// Ensure logger is available here or use console.log if logger is initialized later.
// Checking if logger and logger.info are defined before using them at the module's top level
if (logger && typeof logger.info === 'function') {
    logger.info(`Effective Base URL for OAuth callbacks: ${effectiveAppBaseUrl}`);
    logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`Netlify URL (process.env.URL): ${process.env.URL}`);
    logger.info(`Custom APP_BASE_URL (process.env.APP_BASE_URL): ${process.env.APP_BASE_URL}`);
} else {
    // Fallback to console.log if logger is not yet available or not configured
    console.log(`[passportConfig] Effective Base URL for OAuth callbacks: ${effectiveAppBaseUrl}`);
    console.log(`[passportConfig] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[passportConfig] Netlify URL (process.env.URL): ${process.env.URL}`);
    console.log(`[passportConfig] Custom APP_BASE_URL (process.env.APP_BASE_URL): ${process.env.APP_BASE_URL}`);
}


function configurePassport(passportInstance) {
    // Steam Strategy Configuration
    if (!process.env.STEAM_API_KEY) {
        logger.warn('STEAM_API_KEY is not defined. Passport SteamStrategy will not be available.');
    } else {
        passportInstance.use(new SteamStrategy({
            returnURL: `${effectiveAppBaseUrl}/auth/steam/return`,
            realm: effectiveAppBaseUrl,
            apiKey: process.env.STEAM_API_KEY
        },
        async function(identifier, profile, done) {
        // identifier is the OpenID URL, e.g., https://steamcommunity.com/openid/id/<steamid64>
        // profile contains Steam profile data provided by passport-steam
        // (structure might differ slightly from openid-client or direct steamapi)

        logger.debug('SteamStrategy verify callback triggered.', { steamIdFromProfile: profile.id, displayName: profile.displayName });

        try {
            let user = await User.findOne({ steamId: profile.id });
            let emailToUse;

            // Steam profiles usually don't provide verified emails.
            // We'll use a placeholder if no email is found in the profile.
            // The 'profile.emails' part is speculative for Steam but good practice.
            if (profile.emails && profile.emails[0] && profile.emails[0].value) {
                emailToUse = profile.emails[0].value.toLowerCase();
            } else {
                emailToUse = `${profile.id}@steamuser.placeholder.email`;
            }

            const steamAvatar = (profile.photos && profile.photos.length > 0 ? profile.photos[profile.photos.length - 1].value : null) || (profile._json && profile._json.avatarfull);

            if (user) {
                // User found by steamId, update details
                user.personaName = profile.displayName;
                user.avatar = steamAvatar || user.avatar; // Use new avatar if available
                user.profileUrl = (profile._json && profile._json.profileurl) || user.profileUrl;
                user.lastLoginAt = new Date();

                // If the user somehow has no email or has a placeholder, set the new one.
                // Only overwrite a placeholder email if the new emailToUse is not also a placeholder.
                // Or if user had no email at all, set it.
                if (!user.email || user.email.endsWith('@steamuser.placeholder.email')) {
                    if (emailToUse && !emailToUse.endsWith('@steamuser.placeholder.email')) { // if new email is real
                        user.email = emailToUse;
                        logger.info(`Updated email for Steam user ${user.steamId} to ${emailToUse} (from profile).`);
                    } else if (!user.email) { // user had no email, set placeholder or (rarely) real one
                        user.email = emailToUse;
                        logger.info(`Set initial email for Steam user ${user.steamId} to ${emailToUse}.`);
                    }
                }
                // Ensure name field is also populated if it was missing
                if (!user.name && profile.displayName) {
                    user.name = profile.displayName;
                }

                await user.save();
                logger.info(`Steam user updated via Passport: ${user.steamId} - ${user.personaName}`);
                return done(null, user);
            } else {
                // No user found by steamId.
                // Try to find by email ONLY if Steam provided a real email (very rare).
                // Avoid searching by placeholder email to prevent accidental linking.
                if (emailToUse && !emailToUse.endsWith('@steamuser.placeholder.email')) {
                    user = await User.findOne({ email: emailToUse });
                    if (user) {
                        // User found by real email. Link Steam ID and update details.
                        user.steamId = profile.id;
                        user.personaName = profile.displayName;
                        user.avatar = steamAvatar || user.avatar;
                        user.profileUrl = (profile._json && profile._json.profileurl) || user.profileUrl;
                        user.name = user.name || profile.displayName; // Keep existing name or update from Steam
                        user.lastLoginAt = new Date();
                        await user.save();
                        logger.info(`Linked Steam ID ${profile.id} to existing user ${user.email}.`);
                        return done(null, user);
                    }
                }

                // Still no user, or email was a placeholder: create a new user.
                const newUser = new User({
                    steamId: profile.id,
                    email: emailToUse, // Will be placeholder if Steam didn't provide one
                    personaName: profile.displayName,
                    avatar: steamAvatar,
                    profileUrl: (profile._json && profile._json.profileurl) || null,
                    name: profile.displayName, // Set 'name' field from Steam's displayName
                    lastLoginAt: new Date(),
                    // Password will be undefined; user can set it later if they wish
                });
                await newUser.save();
                logger.info(`New Steam user created via Passport: ${newUser.steamId} - ${newUser.personaName}, Email: ${newUser.email}`);
                return done(null, newUser);
            }
        } catch (err) {
            logger.error('Error in SteamStrategy verify callback', { error: err });
            return done(err);
        }
    }));
    } // End of SteamStrategy configuration block

    // Google Strategy Configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        logger.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not defined. Passport GoogleStrategy will not be available.');
    } else {
        passportInstance.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${effectiveAppBaseUrl}/auth/google/callback`, // Use the common effectiveAppBaseUrl
            scope: ['profile', 'email'] // Ensure scope is passed if not default
        },
        async (accessToken, refreshToken, profile, done) => {
            logger.debug('GoogleStrategy verify callback triggered.', { googleId: profile.id, email: profile.emails && profile.emails[0].value });
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // User found with googleId, update their info
                    user.name = profile.displayName || user.name;
                    if (profile.emails && profile.emails.length > 0) {
                        user.email = profile.emails[0].value; // Update email if changed
                    }
                    if (profile.photos && profile.photos.length > 0) {
                        user.avatar = profile.photos[0].value;
                    }
                    user.lastLoginAt = new Date();
                    await user.save();
                    logger.info(`Google user updated via Passport: ${user.googleId} - ${user.email}`);
                    return done(null, user);
                } else {
                    // No user with this googleId, try to find by email
                    const primaryEmail = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
                    if (!primaryEmail) {
                        logger.error('Google profile did not return an email. Cannot create or link user.');
                        return done(new Error('Email not provided by Google profile.'), null);
                    }

                    user = await User.findOne({ email: primaryEmail });

                    if (user) {
                        // User found by email, link Google account
                        user.googleId = profile.id;
                        user.name = profile.displayName || user.name; // Update name if not set
                        if (profile.photos && profile.photos.length > 0) {
                            user.avatar = profile.photos[0].value; // Update avatar
                        }
                        user.lastLoginAt = new Date();
                        await user.save();
                        logger.info(`Existing user linked with Google ID via Passport: ${user.email} -> ${user.googleId}`);
                        return done(null, user);
                    } else {
                        // New user, create them with Google info
                        const newUser = new User({
                            googleId: profile.id,
                            email: primaryEmail,
                            name: profile.displayName,
                            avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                            // Password will be undefined as it's a Google signup
                        });
                        newUser.lastLoginAt = new Date();
                        await newUser.save();
                        logger.info(`New user created via Google OAuth: ${newUser.googleId} - ${newUser.email}`);
                        return done(null, newUser);
                    }
                }
            } catch (err) {
                logger.error('Error in GoogleStrategy verify callback', { error: err });
                return done(err);
            }
        }));
    } // End of GoogleStrategy configuration block

    // Local Strategy (Email/Password) Configuration
    passportInstance.use(new LocalStrategy({
        usernameField: 'email', // Use email as the username field
        // passReqToCallback: false // Default is false, set true if you need req object in verify callback
    }, async (email, password, done) => {
        try {
            const lowercasedEmail = email.toLowerCase();
            const user = await User.findOne({ email: lowercasedEmail });

            if (!user) {
                logger.debug(`LocalStrategy: No user found for email: ${lowercasedEmail}`);
                return done(null, false, { message: 'Invalid email or password.' });
            }

            // Check if user has a local password set (might be a Google/Steam only user initially)
            if (!user.password) {
                logger.debug(`LocalStrategy: User ${lowercasedEmail} has no local password set (possibly OAuth only account).`);
                return done(null, false, { message: 'Account exists but has no local password. Try OAuth or set a password.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                logger.info(`LocalStrategy: User ${lowercasedEmail} authenticated successfully.`);
                user.lastLoginAt = new Date(); // Update last login time
                await user.save(); // Save the updated lastLoginAt
                return done(null, user);
            } else {
                logger.debug(`LocalStrategy: Invalid password for user: ${lowercasedEmail}`);
                return done(null, false, { message: 'Invalid email or password.' });
            }
        } catch (err) {
            logger.error('Error in LocalStrategy verify callback', { error: err });
            return done(err);
        }
    }));


    passportInstance.serializeUser((user, done) => {
        // user object here is what was returned from the strategy's done(null, user)
        done(null, user.id); // Store MongoDB _id in session
    });

    passportInstance.deserializeUser(async (id, done) => {
        // id here is the MongoDB _id stored by serializeUser
        try {
            const user = await User.findById(id);
            done(null, user); // Attaches user object to req.user
        } catch (err) {
            logger.error('Error deserializing user by ID', { userId: id, error: err });
            done(err);
        }
    });

            logger.info('Passport configured with Local, Steam, and Google Strategies (if env vars are set for OAuth).');
}

module.exports = configurePassport; // Export the function
