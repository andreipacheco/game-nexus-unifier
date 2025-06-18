const express = require('express');
const router = express.Router();
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles, // Added
  getUserTrophyProfileSummary // Added
} = require('psn-api');

// Middleware to extract access token from Authorization header
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: 'Access token is required.' });
  }

  req.accessToken = token;
  next();
};

// Route to initiate PSN authentication (POST with NPSSO token)
router.post('/initiate-auth', async (req, res) => {
  const { npsso } = req.body;

  if (!npsso) {
    return res.status(400).json({ error: 'NPSSO token is required.' });
  }

  try {
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    res.status(200).json({ message: 'NPSSO exchanged for access code. Ready to get auth tokens.', accessCode });
  } catch (error) {
    console.error('Error exchanging NPSSO for access code:', error);
    // Log the actual error for server-side debugging
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange NPSSO for access code.', details: error.message });
  }
});

// Route to exchange access code for auth tokens
router.post('/exchange-code', async (req, res) => {
  const { accessCode } = req.body;

  if (!accessCode) {
    return res.status(400).json({ error: 'Access code is required.' });
  }

  try {
    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    // In a real app, store tokens securely (e.g., HTTP-only cookie or session)
    // For now, returning them. Client should handle them securely.
    res.status(200).json({ message: 'Successfully obtained PSN auth tokens.', authorization });
  } catch (error) {
    console.error('Error exchanging access code for auth tokens:', error);
    // Log the actual error for server-side debugging
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange access code for auth tokens.', details: error.message });
  }
});

// Route to get user's game titles
router.get('/games', authenticateToken, async (req, res) => {
  try {
    const userTitlesResponse = await getUserTitles(
      { accessToken: req.accessToken },
      "me" // "me" refers to the authenticated user
    );
    res.status(200).json(userTitlesResponse);
  } catch (error) {
    console.error('Error fetching user game titles:', error);
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user game titles.', details: error.message });
  }
});

// Route to get user's trophy summary
router.get('/trophy-summary', authenticateToken, async (req, res) => {
  try {
    const trophySummaryResponse = await getUserTrophyProfileSummary(
      { accessToken: req.accessToken },
      "me" // "me" refers to the authenticated user
    );
    res.status(200).json(trophySummaryResponse);
  } catch (error) {
    console.error('Error fetching user trophy summary:', error);
    // console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user trophy summary.', details: error.message });
  }
});

module.exports = router;
