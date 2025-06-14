const request = require('supertest');
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db_auth'; // Set dummy URI
// const app = require('./server'); // REMOVE THIS LINE - app will be required after mocks
const { getOpenIDClient } = require('./config/openid'); // Corrected path
const User = require('./models/User'); // Corrected path
// const SteamAPI = require('steamapi'); // Will be replaced by the mock

// Define mock functions for SteamAPI methods BEFORE jest.mock
const mockGetUserSummaryForAuth = jest.fn();
// Add other SteamAPI methods if auth.js uses them

jest.mock('steamapi', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserSummary: mockGetUserSummaryForAuth,
      // getUserOwnedGames: mockGetUserOwnedGamesForAuth, // if needed
    };
  });
});

// Mock other external services and modules
jest.mock('./config/db', () => jest.fn()); // Mock connectDB
jest.mock('./config/openid'); // Path for mocking is correct as it's relative to test file
jest.mock('./models/User');   // Path for mocking is correct

// Now require app, after mocks are set up
const app = require('./server');

describe('Auth Endpoints', () => {
  const MOCK_APP_BASE_URL = 'http://localhost:5173';
  const MOCK_STEAM_ID = '76561197960287930';

  let mockOpenIDClient;

  beforeEach(() => {
    // Reset mocks before each test
    User.findOne.mockReset();
    User.prototype.save.mockReset();
    User.create.mockReset();
    mockGetUserSummaryForAuth.mockReset();

    // Setup mock for openid-client
    mockOpenIDClient = {
      authorizationUrl: jest.fn(),
      callbackParams: jest.fn(),
      callback: jest.fn(),
    };
    getOpenIDClient.mockResolvedValue(mockOpenIDClient);

    // Mock environment variables
    process.env.APP_BASE_URL = MOCK_APP_BASE_URL;
    // STEAM_API_KEY is used by `new SteamAPI()` in auth.js, ensure it's set for that instantiation
    // process.env.STEAM_API_KEY is set in beforeEach, which is fine if new SteamAPI() happens after.
    // However, auth.js news up SteamAPI at module load. So, STEAM_API_KEY needs to be set *before* auth.js is loaded.
    // Which means, before `const app = require('./server');` which loads `auth.js`.
    // So, moving STEAM_API_KEY setup to the top level of the test file.
    // (Actually, it's already set before require('./server') by being outside beforeEach, that's fine)
    process.env.STEAM_API_KEY = 'test_steam_api_key_auth';
  });

  // afterEach is not strictly needed if beforeEach resets all necessary mocks.
  // jest.clearAllMocks() can be too broad if some mocks are set up once.
  // Specific mock resets (e.g., mockGetUserSummaryForAuth.mockClear()) are better.
  // For now, let's keep it simple.

  describe('GET /auth/steam', () => {
    it('should redirect to Steam OpenID provider', async () => {
      const expectedAuthUrl = 'https://steamcommunity.com/openid/login?openid.mode=checkid_setup&...';
      mockOpenIDClient.authorizationUrl.mockReturnValue(expectedAuthUrl);

      const response = await request(app).get('/auth/steam');

      expect(getOpenIDClient).toHaveBeenCalled();
      expect(mockOpenIDClient.authorizationUrl).toHaveBeenCalledWith(expect.objectContaining({
        'openid.mode': 'checkid_setup', // Verify openid.mode
        'openid.return_to': `${MOCK_APP_BASE_URL}/auth/steam/callback`,
        'openid.realm': MOCK_APP_BASE_URL,
      }));
      expect(response.status).toBe(302);
      expect(response.header.location).toBe(expectedAuthUrl);
    });

    it('should return 500 if OpenID client fails to initialize', async () => {
      getOpenIDClient.mockResolvedValue(null); // Simulate failure
      const response = await request(app).get('/auth/steam');
      expect(response.status).toBe(500);
      expect(response.text).toContain('OpenID client not initialized');
    });
  });

  describe('GET /auth/steam/callback', () => {
    const mockSteamUserSummary = {
      nickname: 'Test User',
      avatar: { large: 'avatar_url' },
      url: 'profile_url',
    };

    beforeEach(() => {
      // Mock successful OpenID callback
      mockOpenIDClient.callbackParams.mockReturnValue({}); // Dummy params
      mockOpenIDClient.callback.mockResolvedValue({
        claims: () => ({ 'openid.claimed_id': `https://steamcommunity.com/openid/id/${MOCK_STEAM_ID}` }),
      });
      // Mock successful SteamAPI user summary fetch
      mockGetUserSummaryForAuth.mockResolvedValue(mockSteamUserSummary);
    });

    it('should create a new user if not found and redirect', async () => {
      User.findOne.mockResolvedValue(null);
      // Mock the save method on the prototype, which `new User().save()` will use.
      // The save method should return the saved document (or a representation of it).
      const expectedUserData = {
        steamId: MOCK_STEAM_ID,
        personaName: mockSteamUserSummary.nickname,
        avatar: mockSteamUserSummary.avatar.large,
        profileUrl: mockSteamUserSummary.url,
      };
      User.prototype.save.mockImplementation(function() {
        // `this` refers to the document being saved. Copy data to simulate save.
        Object.assign(this, expectedUserData);
        return Promise.resolve(this);
      });

      const response = await request(app).get('/auth/steam/callback?some=params');

      expect(mockOpenIDClient.callback).toHaveBeenCalled();
      expect(User.findOne).toHaveBeenCalledWith({ steamId: MOCK_STEAM_ID });
      expect(mockGetUserSummaryForAuth).toHaveBeenCalledWith(MOCK_STEAM_ID);

      // Verify that `new User(data).save()` was called by checking the mock `save`.
      // User constructor will be called with the correct data.
      expect(User.prototype.save).toHaveBeenCalled();
      // Optionally, check the arguments passed to new User() if User constructor itself is mocked.
      // For now, checking that save was called is a good indicator.

      expect(response.status).toBe(302);
      expect(response.header.location).toBe(`${MOCK_APP_BASE_URL}/dashboard?steam_login_success=true&steamid=${MOCK_STEAM_ID}`);
    });

    it('should update an existing user and redirect', async () => {
      const mockExistingUserInstance = {
        steamId: MOCK_STEAM_ID,
        personaName: 'Old Name',
        avatar: 'old_avatar',
        profileUrl: 'old_profile_url',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockExistingUserInstance);

      const response = await request(app).get('/auth/steam/callback?some=params');

      expect(User.findOne).toHaveBeenCalledWith({ steamId: MOCK_STEAM_ID });
      expect(mockGetUserSummaryForAuth).toHaveBeenCalledWith(MOCK_STEAM_ID);
      expect(mockExistingUserInstance.save).toHaveBeenCalled();
      expect(mockExistingUserInstance.personaName).toBe(mockSteamUserSummary.nickname);
      expect(mockExistingUserInstance.avatar).toBe(mockSteamUserSummary.avatar.large);

      expect(response.status).toBe(302);
      expect(response.header.location).toBe(`${MOCK_APP_BASE_URL}/dashboard?steam_login_success=true&steamid=${MOCK_STEAM_ID}`);
    });

    it('should handle OpenID validation failure', async () => {
      mockOpenIDClient.callback.mockRejectedValue(new Error('OpenID validation failed'));

      const response = await request(app).get('/auth/steam/callback?some=params');

      expect(response.status).toBe(500); // Or 400 depending on error handling in route
      expect(response.text).toContain('Authentication failed');
    });

    it('should handle missing claimed_id from OpenID', async () => {
      mockOpenIDClient.callback.mockResolvedValue({ claims: () => ({}) }); // No claimed_id
      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(400); // Expect 400 as per route logic
      expect(response.text).toContain('Claimed ID not found');
    });

    it('should handle invalid SteamID format from OpenID', async () => {
      mockOpenIDClient.callback.mockResolvedValue({ claims: () => ({ 'openid.claimed_id': 'invalid_id_format' }) });
      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(400); // Expect 400 as per route logic
      expect(response.text).toContain('Could not extract SteamID');
    });

    it('should handle failure to fetch user summary from SteamAPI', async () => {
      User.findOne.mockResolvedValue(null);
      mockGetUserSummaryForAuth.mockRejectedValue(new Error('SteamAPI fetch failed'));
      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(500);
      // The exact text might depend on how the error is bubbled up and handled in your route
      expect(response.text).toContain('Authentication failed');
    });

    it('should handle MongoDB findOne error', async () => {
      User.findOne.mockRejectedValue(new Error('MongoDB findOne failed'));
      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Authentication failed due to an internal error.');
    });

    it('should handle MongoDB save error for new user', async () => {
      User.findOne.mockResolvedValue(null); // New user
      mockGetUserSummaryForAuth.mockResolvedValue(mockSteamUserSummary); // SteamAPI success
      User.prototype.save.mockRejectedValue(new Error('MongoDB save failed')); // Mongoose save fails

      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Authentication failed due to an internal error.');
    });

    it('should handle MongoDB save error for existing user', async () => {
      const mockExistingUserInstance = {
        steamId: MOCK_STEAM_ID,
        personaName: 'Old Name',
        save: jest.fn().mockRejectedValue(new Error('MongoDB save failed'))
      };
      User.findOne.mockResolvedValue(mockExistingUserInstance);
      mockGetUserSummaryForAuth.mockResolvedValue(mockSteamUserSummary); // SteamAPI success

      const response = await request(app).get('/auth/steam/callback?params');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Authentication failed due to an internal error.');
    });

  });
});
