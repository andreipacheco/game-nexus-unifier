const express = require('express');
const router = express.Router();
const { getOpenIDClient } = require('../config/openid');
const User = require('../models/User');
const SteamAPI = require('steamapi'); // To fetch user details

// Ensure STEAM_API_KEY is loaded for SteamAPI
if (!process.env.STEAM_API_KEY) {
  console.warn('STEAM_API_KEY is not defined. Steam user data fetching will fail.');
  // throw new Error('STEAM_API_KEY is not defined in environment variables.');
}
const steam = new SteamAPI(process.env.STEAM_API_KEY);

// GET /auth/steam - Redirects user to Steam for authentication
router.get('/steam', async (req, res) => {
  try {
    const client = await getOpenIDClient();
    if (!client) {
      return res.status(500).send('OpenID client not initialized');
    }

    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      console.error('APP_BASE_URL is not configured.');
      return res.status(500).send('Application base URL is not configured.');
    }

    const returnToUrl = `${appBaseUrl}/auth/steam/callback`;
    // For Steam, the realm is usually your application's base URL.
    // Some OpenID 1.0 providers might be strict about this.
    const realm = appBaseUrl;

    const authUrl = client.authorizationUrl({
      // scope is not typically used or standardized in Steam's OpenID 1.0 like implementation.
      // The claimed_id dictates what you get back.
      // openid.ns: 'http://specs.openid.net/auth/2.0', // Optional, Steam uses a version of OpenID 1.1/2.0
      'openid.mode': 'checkid_setup',
      'openid.ns.sreg': 'http://openid.net/extensions/sreg/1.1', // Simple Registration Extension
      'openid.sreg.required': 'nickname,email,fullname', // Optional: Request basic profile fields (Steam might not provide all)
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.return_to': returnToUrl,
      'openid.realm': realm,
    });

    // console.log(`Redirecting to Steam: ${authUrl}`);
    res.redirect(authUrl);

  } catch (error) {
    console.error('Error during Steam auth redirect:', error);
    res.status(500).send('Authentication initiation failed.');
  }
});

// GET /auth/steam/callback - Handles callback from Steam
router.get('/steam/callback', async (req, res) => {
  try {
    const client = await getOpenIDClient();
    if (!client) {
      return res.status(500).send('OpenID client not initialized');
    }

    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      console.error('APP_BASE_URL is not configured.');
      return res.status(500).send('Application base URL is not configured.');
    }
    const returnToUrl = `${appBaseUrl}/auth/steam/callback`;
    const realm = appBaseUrl;

    // The openid-client library expects the full request URL or query parameters.
    // req.query will contain the OpenID response parameters.
    const params = client.callbackParams(req);
    // console.log('Received callback params:', params);

    // Validate the assertion
    // For Steam's OpenID, the claimed_id is the key piece of information.
    // The library's callback method handles the validation based on the OpenID protocol.
    const checks = {
        return_to: returnToUrl, // Ensure the return_to URL matches
        realm: realm,           // Ensure realm matches
        // nonce: storedNonce,  // If you used a nonce, you'd verify it here. Steam doesn't typically use nonce in this flow.
    };

    const tokenSet = await client.callback(returnToUrl, params, checks);
    // console.log('received and validated tokenset %j', tokenSet);
    // console.log('validated ID Token claims %j', tokenSet.claims());

    const claimedId = tokenSet.claims()['openid.claimed_id'];
    if (!claimedId) {
      throw new Error('Claimed ID not found in OpenID response.');
    }

    // Using new RegExp to avoid potential literal parsing issues with slashes
    const steamIdMatch = claimedId.match(new RegExp("https://steamcommunity\\.com/openid/id/(\\d+)"));
    if (!steamIdMatch || !steamIdMatch[1]) {
      throw new Error('Could not extract SteamID from claimed_id.');
    }
    const steamId = steamIdMatch[1];

    // At this point, authentication is successful and you have the user's SteamID.
    // Find or create user in your database.
    let user = await User.findOne({ steamId: steamId });

    if (user) {
      // User exists, potentially update their info if needed
      // For example, if personaName or avatar might change on Steam.
      // You could fetch fresh summary here or rely on a periodic sync.
      console.log(`User found: ${user.personaName} (SteamID: ${steamId})`);
      // Optionally, update some fields if they might change on Steam
      const summary = await steam.getUserSummary(steamId);
      user.personaName = summary.nickname; // SteamAPI calls it nickname
      user.avatar = summary.avatar.large; // or medium/full
      user.profileUrl = summary.url;
      await user.save();

    } else {
      // New user, fetch their details from Steam API and create them
      const summary = await steam.getUserSummary(steamId);
      if (!summary) {
        throw new Error(`Failed to fetch Steam user summary for SteamID: ${steamId}`);
      }
      user = new User({
        steamId: steamId,
        personaName: summary.nickname, // SteamAPI calls it nickname
        avatar: summary.avatar.large, // or medium/full
        profileUrl: summary.url,
      });
      await user.save();
      console.log(`New user created: ${user.personaName} (SteamID: ${steamId})`);
    }

    // TODO: Implement session management (e.g., using express-session and storing user._id in session)
    // For now, just redirecting.
    // In a real app, you'd likely set a cookie or JWT here.
    console.log(`Authentication successful for SteamID: ${steamId}. Redirecting to frontend.`);
    res.redirect(`${appBaseUrl}/dashboard?steam_login_success=true&steamid=${steamId}`); // Or to a page that indicates login success

  } catch (error) {
    console.error('Error in Steam callback:', error);
    // Check if error is from openid-client to provide more specific feedback
    if (error.name === 'OPError') {
        console.error('OpenID Protocol Error:', error.message, error.response ? error.response.body : '');
        return res.status(400).send(`OpenID Authentication Failed: ${error.message}`);
    }
    // Handle specific custom errors for testing
    if (error.message.includes('Claimed ID not found') ||
        error.message.includes('Could not extract SteamID')) {
      return res.status(400).send(`Authentication Error: ${error.message}`);
    }
    // Default internal error for other issues
    res.status(500).send('Authentication failed due to an internal error.');
  }
});

module.exports = router;
