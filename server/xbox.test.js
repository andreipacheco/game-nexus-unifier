const request = require('supertest');
const express = require('express');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const axios = require('axios');
const XboxGame = require('./models/XboxGame');
const xboxRoutes = require('./routes/xbox');
const logger = require('./config/logger'); // Will be mocked

jest.mock('axios'); // Mock axios
jest.mock('./config/logger', () => ({ // Mock logger
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

let app;
let mongoServer;
let originalXblApiKey;

describe('/api/xbox/user/:xuid/games', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    app = express();
    app.use(express.json());

    originalXblApiKey = process.env.XBL_API_KEY;
    // Set a default test API key if not already set by the environment
    if (!process.env.XBL_API_KEY) {
      process.env.XBL_API_KEY = 'test_xbl_api_key_default';
    }
    app.use('/api/xbox', xboxRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (originalXblApiKey === undefined) {
      delete process.env.XBL_API_KEY;
    } else {
      process.env.XBL_API_KEY = originalXblApiKey;
    }
    jest.resetModules(); // Clean up any module caching influenced by env changes
  });

  beforeEach(async () => {
    await XboxGame.deleteMany({});
    jest.clearAllMocks();
  });

  const mockXuid = '1234567890123456';
  const mockXblGameData = {
    titles: [
      {
        titleId: '123',
        name: 'Halo Infinite',
        displayImage: 'halo.jpg',
        achievement: { currentAchievements: 50, totalAchievements: 100, currentGamerscore: 500, totalGamerscore: 1000 },
      },
      {
        titleId: '456',
        name: 'Forza Horizon 5',
        displayImage: 'forza.jpg',
        achievement: { currentAchievements: 20, totalAchievements: 80, currentGamerscore: 200, totalGamerscore: 800 },
      },
    ],
  };

  it('should fetch games successfully from xbl.io API (no cache)', async () => {
    axios.get.mockResolvedValueOnce({ data: mockXblGameData });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(mockXblGameData.titles.length);
    expect(response.body[0].name).toBe(mockXblGameData.titles[0].name);
    expect(axios.get).toHaveBeenCalledTimes(1);
    // Check that the URL for achievements was called, and headers were passed
    expect(axios.get).toHaveBeenCalledWith(
      `https://xbl.io/api/v2/achievements/player/${mockXuid}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Authorization': process.env.XBL_API_KEY,
          'Accept': 'application/json',
        }),
      })
    );

    const dbGames = await XboxGame.find({ xuid: mockXuid });
    expect(dbGames).toHaveLength(mockXblGameData.titles.length);
    expect(dbGames[0].name).toBe(mockXblGameData.titles[0].name);
    expect(dbGames[0].achievements.currentGamerscore).toBe(mockXblGameData.titles[0].achievement.currentGamerscore);
  });

  it('should serve games from cache if available and fresh', async () => {
    const gameToCache = new XboxGame({
      xuid: mockXuid,
      titleId: '789',
      name: 'Cached Game',
      displayImage: 'cache.jpg',
      achievements: { currentAchievements: 10, totalAchievements: 20, currentGamerscore: 100, totalGamerscore: 200 },
      lastUpdated: new Date(),
    });
    await gameToCache.save();

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Cached Game');
    expect(axios.get).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Serving 1 Xbox games from cache for xuid: ${mockXuid}`));
  });

  it('should fetch from API if cache is stale', async () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const gameToCache = new XboxGame({
      xuid: mockXuid,
      titleId: '789',
      name: 'Stale Cached Game',
      achievements: { currentAchievements: 10, totalAchievements: 20, currentGamerscore: 100, totalGamerscore: 200 },
      lastUpdated: twentyFiveHoursAgo,
    });
    await gameToCache.save();

    axios.get.mockResolvedValueOnce({ data: mockXblGameData });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(mockXblGameData.titles.length);
    expect(response.body[0].name).toBe(mockXblGameData.titles[0].name);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`No fresh Xbox games in cache for xuid: ${mockXuid}. Fetching from xbl.io API.`));
  });

  it('should return 400 if XUID is not provided', async () => {
    // Note: Express routing might make '/api/xbox/user//games' match a route with xuid as empty string.
    // If xuid is a path param like /:xuid, an empty segment might not be routed as expected,
    // or xuid might be an empty string. The route validation `if (!xuid)` handles this.
    const response = await request(app).get('/api/xbox/user/ /games').set('xuid', ''); // Or send an invalid xuid
    expect(response.status).toBe(400); // Or check the specific behavior for "empty" xuid
    // The route has `router.get('/user/:xuid/games'`, so an empty xuid in path might lead to 404 if not handled.
    // Let's test with a clearly invalid placeholder that won't match the route expecting an XUID.
    // However, the code specifically checks `if (!xuid)`. An empty string for xuid param would trigger this.
    // For this test, let's assume the route is hit and `req.params.xuid` is empty or undefined.
    // A request to `/api/xbox/user//games` might result in xuid being an empty string.
    // A more direct test:
    const resDirect = await request(app).get(`/api/xbox/user/${''}/games`);
    expect(resDirect.status).toBe(400);
    expect(resDirect.body.error).toContain('Xbox User ID (XUID) is required.');
  });

  it('should return 500 if XBL_API_KEY is not configured', async () => {
    const originalKey = process.env.XBL_API_KEY;
    delete process.env.XBL_API_KEY;

    jest.resetModules(); // Reset module cache
    const tempXboxRoutes = require('./routes/xbox');
    const tempApp = express();
    tempApp.use(express.json());
    tempApp.use('/api/xbox', tempXboxRoutes);

    const response = await request(tempApp).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Xbox API key not configured on server.');

    process.env.XBL_API_KEY = originalKey; // Restore
    jest.resetModules(); // Reset again for other tests
    // Re-mount original routes for subsequent tests if app instance is reused across describe blocks (not the case here)
    // For safety, ensure the main `app` uses the original routes module if needed, though `beforeAll` sets it up once.
  });

  it('should handle xbl.io API error (401 Unauthorized)', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error_message: 'Invalid API Key or access denied.' } } // xbl.io error structure
    });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Xbox API request unauthorized.');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("API responded with status 401"), expect.any(Object));
  });

  it('should handle xbl.io API error (403 Forbidden - e.g. private profile)', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error_message: 'User profile is private or does not allow access.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Access to Xbox API forbidden.');
  });


  it('should handle xbl.io API error (404 Not Found - e.g. invalid XUID)', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { error_message: 'The requested XUID does not exist.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Xbox user profile not found');
  });

  it('should handle xbl.io API error (429 Too Many Requests)', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { error_message: 'Rate limit exceeded.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many requests to Xbox API.');
  });

  it('should handle xbl.io API returning no titles (empty array)', async () => {
    axios.get.mockResolvedValueOnce({ data: { titles: [] } });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`No Xbox games with achievements found for xuid: ${mockXuid}`));

    // Check that "no games" is cached by trying to fetch again
    // This time, API should not be called.
    jest.clearAllMocks(); // Clear mocks before next call
    const response2 = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response2.status).toBe(200);
    expect(response2.body).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Serving 0 Xbox games from cache for xuid: ${mockXuid}`));
  });

  it('should handle xbl.io API returning unexpected structure (e.g., no titles field)', async () => {
    axios.get.mockResolvedValueOnce({ data: { message: "Some unexpected response" } }); // No 'titles'
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Unexpected response structure from xbl.io API.');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("xbl.io API response structure was not as expected"), expect.any(Object));
  });

  it('should handle general network error from axios (no response)', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      request: {}, // Indicates request was made but no response received
      message: 'Network Error'
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(503); // Service Unavailable
    expect(response.body.error).toContain('No response from xbl.io API.');
  });

  it('should handle non-axios error during API call', async () => {
    axios.get.mockRejectedValueOnce(new Error('Some random error'));
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Failed to fetch Xbox games from xbl.io.');
  });

});

describe('/api/xbox/user/:xuid/game/:titleId/achievements', () => {
  const mockXuid = '1234567890123456';
  const mockTitleId = 'mockGameTitleId123';
  const mockApiDetailedAchievements = [
    { id: 'ach1', name: 'First Achievement', description: 'Unlock this first.', progressState: 'Achieved', rewards: [{ type: 'Gamerscore', value: 10 }] },
    { id: 'ach2', name: 'Second Achievement', description: 'Then this one.', progressState: 'NotAchieved', rewards: [{ type: 'Gamerscore', value: 20 }] },
  ];

  it('should fetch detailed achievements successfully', async () => {
    axios.get.mockResolvedValueOnce({ data: mockApiDetailedAchievements });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockApiDetailedAchievements); // Backend returns raw data for now
    expect(axios.get).toHaveBeenCalledWith(
      `https://xbl.io/api/v2/achievements/player/${mockXuid}/${mockTitleId}`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Authorization': process.env.XBL_API_KEY }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully fetched ${mockApiDetailedAchievements.length} detailed achievements`));
  });

  it('should return 400 if XUID is missing', async () => {
    const response = await request(app).get(`/api/xbox/user//game/${mockTitleId}/achievements`);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Xbox User ID (XUID) and Title ID are required.');
  });

  it('should return 400 if titleId is missing', async () => {
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game//achievements`);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Xbox User ID (XUID) and Title ID are required.');
  });

  it('should handle xbl.io API error (404 Not Found) for detailed achievements', async () => {
    const apiErrorMsg = 'Achievements not found for specified title or user.';
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { error_message: apiErrorMsg } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(404);
    // The route now uses the error_message from xbl.io if available, then a fallback
    expect(response.body.error).toEqual(expect.stringContaining(apiErrorMsg)); // Check if it includes original message
    expect(response.body.error).toEqual(expect.stringContaining(`Detailed achievements not found for xuid ${mockXuid}, titleId ${mockTitleId}`)); // Check for the fallback part
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("API responded with status 404"), expect.any(Object));
  });

  it('should handle xbl.io API error (401 Unauthorized) for detailed achievements', async () => {
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error_message: 'Invalid API Key' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(401);
    expect(response.body.error).toEqual(expect.stringContaining('Xbox API request unauthorized'));
  });

  it('should handle xbl.io API returning an empty array for achievements', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully fetched 0 detailed achievements`));
  });

  it('should handle unexpected (non-array) response structure from xbl.io for achievements', async () => {
    axios.get.mockResolvedValueOnce({ data: { message: "This is not an array of achievements" } });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    // Current implementation logs a warning and returns an empty array if structure is not as expected.
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]); // Expect empty array due to current handling
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unexpected response structure for detailed achievements"), expect.any(Object));
  });

  // Test for XBL_API_KEY missing for this specific endpoint (if not globally handled by a beforeAll,
  // which it is, but a more specific test can be added if needed, similar to the one for the /games endpoint)
  // For brevity, assuming the global API key check test in the other describe block is sufficient.
});
