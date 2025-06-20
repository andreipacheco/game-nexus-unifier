const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User'); // Import User model
const logger = require('../config/logger');
const PsnGame = require('../models/PsnGame'); // Import PsnGame model
const SteamGame = require('../models/SteamGame'); // Import SteamGame model
const XboxGame = require('../models/XboxGame'); // Import XboxGame model

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
  const { _id, steamId, googleId, email, name, personaName, avatar, profileUrl, createdAt, psnAccountId, psnOnlineId } = req.user;

  const profileData = {
    id: _id, // Expose user ID
    steamId,
    googleId,
    email,
    name: name || personaName, // Use 'name' if available, fallback to 'personaName'
    avatarFull: avatar,
    profileUrl,
    createdAt,
    psnAccountId,    // Add this
    psnOnlineId      // Add this
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

module.exports = router;

// GET /api/user/stats - Fetches consolidated game statistics for the authenticated user
router.get('/stats', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const steamId = req.user.steamId;
    const xuid = req.user.xuid; // This might be undefined, and that's okay

    let steamGames = [];
    let psnGames = [];
    let xboxGames = [];

    // Fetch Steam games
    if (steamId) {
      steamGames = await SteamGame.find({ steamId: steamId });
      logger.info(`Fetched ${steamGames.length} Steam games for user ${userId}`);
    } else {
      logger.info(`No Steam ID found for user ${userId}, skipping Steam games fetch.`);
    }

    // Fetch PSN games
    // Assuming PsnGame stores a reference to the User model's _id
    psnGames = await PsnGame.find({ userId: userId });
    logger.info(`Fetched ${psnGames.length} PSN games for user ${userId}`);

    // Fetch Xbox games
    if (xuid) {
      xboxGames = await XboxGame.find({ xuid: xuid });
      logger.info(`Fetched ${xboxGames.length} Xbox games for user ${userId}`);
    } else {
      logger.info(`No XUID found for user ${userId}, skipping Xbox games fetch.`);
    }

    // Transformation functions
    const transformSteamGame = (game) => ({
      id: String(game.appId),
      appId: String(game.appId),
      title: game.name || 'Unknown Title',
      platform: 'steam',
      coverImage: game.imgIconURL || game.imgLogoURL || 'default_steam_cover.png', // Ensure you have a default image path or URL
      playtime: game.playtimeForever ? game.playtimeForever / 60 : 0,
      lastPlayed: '', // Steam API via steamwebapi node package doesn't provide this directly for all games
      achievements: {
        unlocked: game.achievements && game.achievements.achieved ? game.achievements.achieved : 0, //old steam-games field was achieved
        total: game.achievements && game.achievements.total ? game.achievements.total : 0, //old steam-games field was total
      },
      status: 'not_installed', // This info is not available from the basic game list
      genre: [], // Not available in basic Steam game details
      releaseYear: 0, // Not available in basic Steam game details
    });

    const transformPsnGame = (game) => ({
      id: game.npCommunicationId,
      appId: game.npCommunicationId,
      title: game.trophyTitleName || 'Unknown Title',
      platform: 'psn',
      coverImage: game.trophyTitleIconUrl || 'default_psn_cover.png',
      playtime: 0, // PSN API typically doesn't provide playtime easily for all games
      lastPlayed: game.lastUpdatedDateTime ? new Date(game.lastUpdatedDateTime).toISOString() : '',
      achievements: {
        unlocked: (game.earnedTrophies?.bronze || 0) +
                  (game.earnedTrophies?.silver || 0) +
                  (game.earnedTrophies?.gold || 0) +
                  (game.earnedTrophies?.platinum || 0),
        total: (game.definedTrophies?.bronze || 0) +
               (game.definedTrophies?.silver || 0) +
               (game.definedTrophies?.gold || 0) +
               (game.definedTrophies?.platinum || 0),
      },
      status: 'not_installed',
      genre: [],
      releaseYear: 0,
    });

    const transformXboxGame = (game) => ({
      id: String(game.titleId),
      appId: String(game.titleId),
      title: game.name || 'Unknown Title',
      platform: 'xbox',
      coverImage: game.displayImage || 'default_xbox_cover.png',
      playtime: 0, // Xbox API might provide this, but not in all contexts
      lastPlayed: game.lastUpdated ? new Date(game.lastUpdated).toISOString() : '',
      achievements: {
        unlocked: game.achievements?.currentAchievements || 0,
        total: game.achievements?.totalAchievements || 0,
        currentGamerscore: game.achievements?.currentGamerscore || 0,
        totalGamerscore: game.achievements?.totalGamerscore || 0,
      },
      status: 'not_installed',
      genre: [],
      releaseYear: 0,
    });

    const transformedSteamGames = steamGames.map(transformSteamGame);
    const transformedPsnGames = psnGames.map(transformPsnGame);
    const transformedXboxGames = xboxGames.map(transformXboxGame);

    // Consolidate all transformed games into a single array
    const allGames = [...transformedSteamGames, ...transformedPsnGames, ...transformedXboxGames];
    logger.info(`Total consolidated and transformed games fetched for user ${userId}: ${allGames.length}`);

    res.json({ games: allGames });
  } catch (error) {
    logger.error('Error fetching user game stats:', { userId: req.user._id, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'An error occurred while fetching game statistics.' });
  }
});
