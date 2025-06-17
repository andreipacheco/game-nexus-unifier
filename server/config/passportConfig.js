// ESM style imports, assuming server might move towards ESM or for consistency if other new files use it.
// If server remains strictly CommonJS, these would be `require`.
// However, given the previous ERR_REQUIRE_ESM issues, using `import` here might be problematic
// if this file is `require`d by `server.js` (a CJS module).
// For now, I will use CommonJS `require` to match `server.js` context and avoid new ESM issues.

const passport = require('passport');
// passport-steam strategy is typically exported as `Strategy`
const SteamStrategy = require('passport-steam').Strategy;
const User = require('../models/User'); // Adjust path if User.js is not in ../models/
const logger = require('./logger'); // Adjust path if logger.js is not in ./

function configurePassport(passportInstance) {
    if (!process.env.APP_BASE_URL || !process.env.STEAM_API_KEY) {
        logger.error('APP_BASE_URL or STEAM_API_KEY is not defined. Passport SteamStrategy cannot be fully configured.');
        // Depending on how critical this is, you might throw an error or allow server to run in a degraded state.
        // For now, it will proceed, but strategy will likely fail if used.
    }

    passportInstance.use(new SteamStrategy({
        returnURL: 'http://localhost:3000/auth/steam/return', // Hardcoded for local backend on port 3000
        realm: 'http://localhost:3000', // Changed to match backend origin for local dev
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

    logger.info('Passport configured with SteamStrategy.');
}

module.exports = configurePassport; // Export the function
