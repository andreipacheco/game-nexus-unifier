console.log('[DEBUG] server/routes/user.js: File loaded by Node.js');
const express = require('express');
const router = express.Router();

router.use((req, res, next) => {
  console.log(`[DEBUG] server/routes/user.js: Router middleware hit. Method: ${req.method}, Path: ${req.path}, OriginalURL: ${req.originalUrl}`);
  next();
});

const bcrypt = require('bcrypt');
const User =require('../models/User'); // Import User model
const logger = require('../config/logger');
const PsnGame = require('../models/PsnGame'); // Import PsnGame model

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  logger.warn('Unauthorized access attempt to a protected route.', { path: req.path });
  res.status(401).json({ message: 'User not authenticated. Please log in.' });
};

// GET /api/user/me - Fetches the authenticated user's profile information
router.get('/me', ensureAuthenticated, (req, res) => {
  // req.user is populated by Passport's deserializeUser
  // We select only the fields safe to send to the frontend.
  // Added email and name, as they are now part of the User model
  const { _id, steamId, googleId, email, name, personaName, avatar, profileUrl, createdAt } = req.user;

  const profileData = {
    id: _id, // Expose user ID
    steamId,
    googleId,
    email,
    name: name || personaName, // Use 'name' if available, fallback to 'personaName'
    avatarFull: avatar,
    profileUrl,
    createdAt,
  };

  logger.debug('Authenticated user profile requested.', { userId: req.user.id });
  res.json(profileData);
});

// POST /api/user/change-password - Changes the user's password
router.post('/change-password', ensureAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.error('User not found for ID during password change:', { userId });
      return res.status(404).json({ message: 'User not found.' });
    }

    // Scenario 1: User has an existing local password
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change your existing password.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect current password.' });
      }
    } else {
      // Scenario 2: User does not have a local password (e.g., Google sign-up)
      // and is setting one for the first time.
      // If currentPassword was provided, we can choose to ignore it or log a warning.
      if (currentPassword) {
        logger.warn(`User ${userId} provided currentPassword but has no local password set. Proceeding to set new password.`);
        // Optionally, you could return an error here if this case is not desired:
        // return res.status(400).json({ message: 'Cannot use current password when no local password is set.' });
      }
      // No current password to verify, proceed to set the new one.
    }

    // Hash new password and save (User model's pre-save hook will hash it)
    user.password = newPassword; // Assign plain text, pre-save hook handles hashing
    await user.save();

    logger.info(`Password changed successfully for user: ${userId}`);
    res.json({ message: 'Password changed successfully.' });

  } catch (error) {
    logger.error('Error changing password for user:', { userId, error: error.message });
    res.status(500).json({ message: 'An error occurred while changing the password. Please try again.' });
  }
});

// GET /api/user/:userId/games - Fetches all games for a user from the database
router.get('/:userId/games', ensureAuthenticated, async (req, res) => {
  try {
    // Authorization: Ensure the authenticated user is requesting their own games
    // Alternatively, allow admins to access any user's games (not implemented here)
    if (req.user.id !== req.params.userId) {
      logger.warn(`Unauthorized attempt to access games for user ${req.params.userId} by user ${req.user.id}`);
      return res.status(403).json({ message: 'Forbidden: You can only access your own games.' });
    }

    let allGames = [];

    // Fetch PSN games from MongoDB
    const psnGamesFromDb = await PsnGame.find({ userId: req.params.userId }).lean(); // .lean() for plain JS objects

    const mappedPsnGames = psnGamesFromDb.map(game => ({
      id: game._id.toString(), // Use MongoDB _id as the unique id for the aggregated list
      dbId: game._id.toString(), // Keep original db ID if needed
      title: game.trophyTitleName, // Map from PsnGame schema
      platform: game.platform, // Should be 'PSN'
      coverImage: game.trophyTitleIconUrl, // Map from PsnGame schema
      // Add other common fields that GameCard might expect or for general display
      // These fields might not be directly available or comparable across all platform sources
      // For PSN, we have trophy progress:
      progress: game.progress,
      earnedTrophies: game.earnedTrophies,
      // Fields like playtime, lastPlayed, achievements (in a generic format)
      // would need to be standardized if this route were to aggregate games
      // from other sources that provide them.
      // For now, we only have detailed PSN data from our DB.
      // Ensure that the GameCard component can handle potentially missing fields
      // or provide sensible defaults.
      playtime: 0, // Placeholder
      lastPlayed: game.lastUpdatedFromPsn || game.updatedAt, // Use PSN update time or Mongoose timestamp
      achievements: { // Placeholder structure, adapt if PsnGame stores more details
        unlocked: (game.earnedTrophies?.platinum || 0) +
                  (game.earnedTrophies?.gold || 0) +
                  (game.earnedTrophies?.silver || 0) +
                  (game.earnedTrophies?.bronze || 0),
        total: 0, // This would ideally come from 'definedTrophies' if stored
        currentGamerscore: 0, // PSN doesn't use Gamerscore
        totalGamerscore: 0,
      },
      status: 'owned', // Assuming all stored games are owned
      genre: ['Unknown'], // Placeholder
      releaseYear: 0, // Placeholder
    }));

    allGames = allGames.concat(mappedPsnGames);

    // TODO: In the future, fetch games from other platforms stored in DB if any
    // e.g., const steamDbGames = await SteamGameModel.find({ userId: req.params.userId });
    // allGames = allGames.concat(mapSteamDbGamesToCommonFormat(steamDbGames));

    // Sort games (e.g., by platform then by name)
    allGames.sort((a, b) => {
      if (a.platform < b.platform) return -1;
      if (a.platform > b.platform) return 1;
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      return 0;
    });

    logger.info(`Fetched ${allGames.length} games from database for user ${req.params.userId}`);
    res.json(allGames);

  } catch (error) {
    logger.error('Error fetching games for user from database:', { userId: req.params.userId, error: error.message });
    res.status(500).json({ message: 'An error occurred while fetching games.' });
  }
});

module.exports = router;
