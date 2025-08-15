const request = require('supertest');
const express = require('express');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const XboxGame = require('./models/XboxGame');
const logger = require('./config/logger'); // Will be mocked

// Mock axios to handle the `axios.create` method used in the route.
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: mockAxiosGet,
  })),
  get: mockAxiosGet, // Also mock the global get for other potential uses
}));
jest.mock('./config/logger', () => ({ // Mock logger
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

let app;
let mongoServer;

describe('/api/xbox/user/:xuid/games', () => {
  beforeAll(async () => {
    // Set the API key before any code that might use it is required.
    process.env.XBL_API_KEY = 'test_xbl_api_key_default';

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    app = express();
    app.use(express.json());

    // Require the routes *after* the environment variable is set.
    const xboxRoutes = require('./routes/xbox');
    app.use('/api/xbox', xboxRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await XboxGame.deleteMany({});
    jest.clearAllMocks();
    mockAxiosGet.mockReset();
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
    mockAxiosGet.mockResolvedValueOnce({ data: mockXblGameData });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(mockXblGameData.titles.length);
    expect(response.body[0].name).toBe(mockXblGameData.titles[0].name);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(`/achievements/player/${mockXuid}`);

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
    expect(mockAxiosGet).not.toHaveBeenCalled();
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

    mockAxiosGet.mockResolvedValueOnce({ data: mockXblGameData });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(mockXblGameData.titles.length);
    expect(response.body[0].name).toBe(mockXblGameData.titles[0].name);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`No fresh Xbox games in cache for xuid: ${mockXuid}. Fetching from xbl.io API.`));
  });

  it('should return 400 if XUID is not provided', async () => {
    const resDirect = await request(app).get(`/api/xbox/user/${''}/games`);
    expect(resDirect.status).toBe(400);
    expect(resDirect.body.error).toContain('Xbox User ID (XUID) is required.');
  });

  it('should return 500 if XBL_API_KEY is not configured', async () => {
    const originalKey = process.env.XBL_API_KEY;
    delete process.env.XBL_API_KEY;

    jest.resetModules();
    const tempXboxRoutes = require('./routes/xbox');
    const tempApp = express();
    tempApp.use(express.json());
    tempApp.use('/api/xbox', tempXboxRoutes);

    const response = await request(tempApp).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Xbox API key not configured on server.');

    process.env.XBL_API_KEY = originalKey;
    jest.resetModules();
  });

  it('should handle xbl.io API error (401 Unauthorized)', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error_message: 'Invalid API Key or access denied.' } }
    });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Xbox API request unauthorized.');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("API responded with status 401"), expect.any(Object));
  });

  it('should handle xbl.io API error (403 Forbidden - e.g. private profile)', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error_message: 'User profile is private or does not allow access.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Access to Xbox API forbidden.');
  });


  it('should handle xbl.io API error (404 Not Found - e.g. invalid XUID)', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { error_message: 'The requested XUID does not exist.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Xbox user profile not found');
  });

  it('should handle xbl.io API error (429 Too Many Requests)', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { error_message: 'Rate limit exceeded.' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many requests to Xbox API.');
  });

  it('should handle xbl.io API returning no titles (empty array)', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { titles: [] } });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`No Xbox games with achievements found for xuid: ${mockXuid}`));

    jest.clearAllMocks();
    const response2 = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response2.status).toBe(200);
    expect(response2.body).toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Serving 0 Xbox games from cache for xuid: ${mockXuid}`));
  });

  it('should handle xbl.io API returning unexpected structure (e.g., no titles field)', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { message: "Some unexpected response" } });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Unexpected response structure from xbl.io API.');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("xbl.io API response structure was not as expected"), expect.any(Object));
  });

  it('should handle general network error from axios (no response)', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      request: {},
      message: 'Network Error'
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/games`);
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('No response from xbl.io API.');
  });

  it('should handle non-axios error during API call', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('Some random error'));
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
    mockAxiosGet.mockResolvedValueOnce({ data: mockApiDetailedAchievements });

    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockApiDetailedAchievements);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      `https://xbl.io/api/v2/achievements/player/${mockXuid}/${mockTitleId}`
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
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { error_message: apiErrorMsg } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(404);
    expect(response.body.error).toEqual(expect.stringContaining(apiErrorMsg));
    expect(response.body.error).toEqual(expect.stringContaining(`Detailed achievements not found for xuid ${mockXuid}, titleId ${mockTitleId}`));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("API responded with status 404"), expect.any(Object));
  });

  it('should handle xbl.io API error (401 Unauthorized) for detailed achievements', async () => {
    mockAxiosGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error_message: 'Invalid API Key' } }
    });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(401);
    expect(response.body.error).toEqual(expect.stringContaining('Xbox API request unauthorized'));
  });

  it('should handle xbl.io API returning an empty array for achievements', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: [] });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully fetched 0 detailed achievements`));
  });

  it('should handle unexpected (non-array) response structure from xbl.io for achievements', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { message: "This is not an array of achievements" } });
    const response = await request(app).get(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unexpected response structure for detailed achievements"), expect.any(Object));
  });
});
