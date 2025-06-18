import express from 'express';
import logger from '../utils/logger.js'; // Assuming logger is in utils
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles
} from 'psn-api';

const router = express.Router();

// Route to get user games
// For now, expects NPSSO token in the request body.
// This will be improved later for better token management and security.
router.post('/user/games', async (req, res) => {
  const { npsso } = req.body;

  if (!npsso) {
    logger.warn('NPSSO token is required');
    return res.status(400).json({ error: 'NPSSO token is required' });
  }

  try {
    logger.info('Attempting to exchange NPSSO for access code...');
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    logger.info('Successfully exchanged NPSSO for access code.');

    logger.info('Attempting to exchange access code for auth tokens...');
    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    logger.info('Successfully exchanged access code for auth tokens.');

    logger.info('Fetching user titles (games)...');
    // "me" is a special accountId that refers to the authorized user.
    const userTitlesResponse = await getUserTitles(
      { accessToken: authorization.accessToken },
      "me"
    );
    logger.info(`Successfully fetched ${userTitlesResponse.trophyTitles?.length || 0} user titles.`);

    res.json(userTitlesResponse);
  } catch (error) {
    logger.error('Error in Playstation /user/games route:', error);
    let statusCode = 500;
    let errorMessage = 'An error occurred while fetching Playstation games.';

    if (error instanceof Error) {
        // psn-api might throw errors with specific messages or properties
        // For example, if the NPSSO is invalid or expired.
        // We can check error.message or error.name if the library provides distinct errors.
        // For now, a generic message based on the error thrown by psn-api:
        errorMessage = `Playstation API error: ${error.message}`;
        // Check for specific error types or messages if known for psn-api authentication issues
        if (error.message.includes('invalid_npsso') || error.message.includes('NPSSO')) {
            statusCode = 401; // Unauthorized or bad token
            errorMessage = 'Invalid or expired NPSSO token.';
        } else if (error.message.includes('Access Denied') || error.message.includes('Forbidden')) {
            statusCode = 403;
        }
        // Add more specific error handling as you learn about psn-api's error types
    }

    res.status(statusCode).json({ error: errorMessage, details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
