const express = require('express');
const logger = require('../config/logger');
const User = require('../models/User');
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getProfileFromAccountId,
} = require('psn-api');
const jwtDecode = require('jwt-decode'); // Changed import statement

const router = express.Router();

// POST /api/psn/connect
router.post('/connect', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { npsso } = req.body;
  if (!npsso) {
    return res.status(400).json({ message: 'NPSSO token is required' });
  }

  try {
    logger.info(`Attempting to connect PSN account for user ${req.user.id} with provided NPSSO.`);
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    logger.info(`Successfully exchanged NPSSO for access code for user ${req.user.id}.`);

    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully exchanged access code for auth tokens for user ${req.user.id}.`);

    if (!authorization.idToken) {
      logger.error(`idToken not found in PSN authorization response for user ${req.user.id}.`);
      return res.status(500).json({ message: 'Failed to retrieve idToken from PSN. Cannot determine account ID.' });
    }

    const decodedIdToken = jwtDecode(authorization.idToken);
    logger.info(`Decoded idToken for user ${req.user.id}:`, decodedIdToken);

    const accountIdFromToken = decodedIdToken?.sub;
    if (!accountIdFromToken) {
      logger.error(`accountId (sub) not found in decoded idToken for user ${req.user.id}. Decoded token: ${JSON.stringify(decodedIdToken)}`);
      return res.status(500).json({ message: 'Failed to extract accountId from PSN idToken.' });
    }
    logger.info(`Extracted accountId ${accountIdFromToken} from idToken for user ${req.user.id}.`);

    // accessToken is still needed for getProfileFromAccountId
    const { accessToken, refreshToken } = authorization;

    // Use the accountId extracted from the idToken
    const userPSNProfile = await getProfileFromAccountId({ accessToken }, accountIdFromToken);
    logger.info(`Successfully fetched PSN profile for user ${req.user.id} using accountId ${accountIdFromToken}: ${userPSNProfile.onlineId}`);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        npsso, // Save the original NPSSO
        psnAccountId: accountIdFromToken, // Use accountId from idToken
        psnOnlineId: userPSNProfile.onlineId, // onlineId from the fetched profile
        // Optionally store accessToken and refreshToken if your strategy involves refreshing them
      },
      { new: true }
    ).select('-password -npsso'); // Exclude password and npsso from the returned user object

    if (!user) {
      logger.warn(`User not found during PSN connect process for ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'PSN account connected successfully',
      psnProfile: {
        accountId: accountIdFromToken, // Send back the accountId from idToken
        onlineId: userPSNProfile.onlineId,
        avatarUrl: userPSNProfile.avatarUrls?.[0]?.avatarUrl,
      },
      user, // Send back the updated user object (excluding sensitive fields)
    });

  } catch (error) {
    logger.error(`Error connecting PSN account for user ${req.user.id}:`, error);
    if (error.message && error.message.includes("NPSSO code is expired or invalid")) {
        return res.status(400).json({ message: 'Invalid or expired NPSSO token. Please provide a new one.' });
    }
    // Generic error for other psn-api or database issues
    res.status(500).json({ message: 'Failed to connect to PSN. Please ensure your NPSSO is correct and try again.' });
  }
});

// GET /api/psn/games
router.get('/games', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.npsso) {
      return res.status(400).json({ message: 'PSN account not connected. Please connect your PSN account first via POST /api/psn/connect.' });
    }

    logger.info(`Fetching PSN games for user ${user.id} (${user.psnOnlineId}). Exchanging NPSSO for access code.`);
    const accessCode = await exchangeNpssoForAccessCode(user.npsso);
    logger.info(`Successfully exchanged NPSSO for access code for user ${user.id}. Now exchanging for auth tokens.`);

    const { accessToken } = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info(`Successfully obtained access token for user ${user.id}. Fetching user titles.`);

    const psnUserTitles = await getUserTitles({ accessToken }, "me");
    logger.info(`Successfully fetched ${psnUserTitles.trophyTitles?.length ?? 0} titles for user ${user.id}.`);

    res.json({
        message: 'PSN games fetched successfully',
        games: psnUserTitles.trophyTitles || [],
        totalGames: psnUserTitles.totalItemCount,
    });

  } catch (error) {
    logger.error(`Error fetching PSN games for user ${req.user?.id}:`, error);
    if (error.message && error.message.includes("NPSSO code is expired or invalid")) {
        return res.status(401).json({ message: 'NPSSO token is invalid or expired. Please reconnect your PSN account.' });
    }
    res.status(500).json({ message: 'Error fetching PSN games.' });
  }
});

module.exports = router;
