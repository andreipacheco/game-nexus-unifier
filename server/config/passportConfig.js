// ESM style imports, assuming server might move towards ESM or for consistency if other new files use it.
// If server remains strictly CommonJS, these would be `require`.
// However, given the previous ERR_REQUIRE_ESM issues, using `import` here might be problematic
// if this file is `require`d by `server.js` (a CJS module).
// For now, I will use CommonJS `require` to match `server.js` context and avoid new ESM issues.

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SteamStrategy = require('passport-steam').Strategy;
const User = require('../models/User');
const bcrypt = require('bcrypt'); // For password comparison
const logger = require('./logger');

function configurePassport(passportInstance) {
    // Steam Strategy Configuration
    if (!process.env.STEAM_API_KEY) { // Simplified check, APP_BASE_URL might not be needed for API key alone
        logger.warn('STEAM_API_KEY is not defined. Passport SteamStrategy will not be available.');
    } else {
        passportInstance.use(new SteamStrategy({
            returnURL: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/auth/steam/return` : 'http://localhost:3001/auth/steam/return', // Assuming server on 3001
            realm: process.env.APP_BASE_URL || 'http://localhost:3001', // Assuming server on 3001
            apiKey: process.env.STEAM_API_KEY
        },
        async function(identifier, profile, done) {
        // identifier is the OpenID URL, e.g., https://steamcommunity.com/openid/id/<steamid64>
        // profile contains Steam profile data provided by passport-steam
        // (structure might differ slightly from openid-client or direct steamapi)

        logger.debug('SteamStrategy verify callback triggered.', { steamIdFromProfile: profile.id, displayName: profile.displayName });

        try {
            let user = await User.findOne({ steamId: profile.id });

            if (user) {
                // User found, update their information
                user.personaName = profile.displayName;
                // passport-steam provides photos in an array, last one is usually largest/full
                user.avatar = profile.photos && profile.photos.length > 0 ? profile.photos[profile.photos.length - 1].value : user.avatar;
                // profile._json might contain more details like profileurl
                if (profile._json && profile._json.profileurl) {
                    user.profileUrl = profile._json.profileurl;
                }
                // lastSteamSync or similar fields could be updated here
                user.lastLoginAt = new Date();
                await user.save();
                logger.info(`Steam user updated via Passport: ${user.steamId} - ${user.personaName}`);
                return done(null, user);
            } else {
                // New user, create them
                const newUser = new User({
                    steamId: profile.id,
                    personaName: profile.displayName,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[profile.photos.length - 1].value : null,
                    profileUrl: profile._json && profile._json.profileurl ? profile._json.profileurl : null,
                    // other fields can be added as needed
                });
                newUser.lastLoginAt = new Date();
                await newUser.save();
                logger.info(`New Steam user created via Passport: ${newUser.steamId} - ${newUser.personaName}`);
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
            callbackURL: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/auth/google/callback` : 'http://localhost:3001/auth/google/callback', // Assuming server on 3001
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
