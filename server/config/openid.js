// const { Issuer } = require('openid-client'); // To be dynamically imported
const dotenv = require('dotenv');
const logger = require('./logger'); // Assuming logger is in the same dir or path is adjusted

// Ensure environment variables are loaded
// In server.js, dotenv.config() is already called, but good practice for standalone config script.
if (process.env.NODE_ENV !== 'test') {
    dotenv.config({ path: require('find-config')('.env') || require('path').resolve(__dirname, '../.env') });
}

let openidClient = null;

const getOpenIDClient = async () => {
  if (openidClient) {
    return openidClient;
  }

  try {
    // Dynamically import openid-client
    const { Issuer } = await import('openid-client');
    logger.debug('openid-client module loaded dynamically.');

    const steamIssuer = await Issuer.discover('https://steamcommunity.com/openid');
    logger.debug('Discovered Steam OpenID issuer: %s', steamIssuer.issuer);

    if (!process.env.APP_BASE_URL) {
      throw new Error('APP_BASE_URL is not defined in environment variables.');
    }

    // The client does not need a client_id or client_secret for Steam OpenID 1.0 like flows.
    // The "client_id" here is effectively the realm/return_to URL.
    openidClient = new steamIssuer.Client({
      // No client_id or client_secret needed for Steam's OpenID implementation.
      // The redirect URIs are specified dynamically when generating the auth URL.
    });

    return openidClient;
  } catch (error) {
    console.error('Failed to discover Steam OpenID issuer or initialize client:', error);
    // Depending on the application's needs, you might want to throw the error,
    // or handle it in a way that the app can gracefully degrade.
    // For now, exiting if critical setup fails.
    // In test env, this will throw due to db.js modification, otherwise process.exit
    // Consider re-throwing or returning null to let caller handle if process.exit is too harsh.
    logger.error('Exiting due to OpenID client initialization failure.');
    process.exit(1);
  }
};

module.exports = { getOpenIDClient };
