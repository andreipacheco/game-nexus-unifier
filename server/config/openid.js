const { Issuer } = require('openid-client');
const dotenv = require('dotenv');

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
    const steamIssuer = await Issuer.discover('https://steamcommunity.com/openid');
    // console.log('Discovered issuer %s %O', steamIssuer.issuer, steamIssuer.metadata);

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
    process.exit(1);
  }
};

module.exports = { getOpenIDClient };
