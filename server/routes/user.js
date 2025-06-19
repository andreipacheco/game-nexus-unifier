const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User'); // Import User model
const logger = require('../config/logger');

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
