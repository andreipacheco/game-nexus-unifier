const request = require('supertest');
const axios = require('axios');
const SteamGame = require('../models/SteamGame'); // Actual path to model
const logger = require('./config/logger'); // To potentially spy on logger.error

// Mock axios
jest.mock('axios');

// Mock Mongoose model SteamGame
// We mock the static methods find and findOneAndUpdate
const mockSteamGameFind = jest.fn();
const mockSteamGameFindOneAndUpdate = jest.fn();

jest.mock('../models/SteamGame', () => ({
  find: mockSteamGameFind,
  findOneAndUpdate: mockSteamGameFindOneAndUpdate,
}));

// Mock logger to spy on error calls if needed, or suppress console output during tests
jest.mock('./config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));


// Mock for 'steamapi' if other routes still use it.
// For the '/games' endpoint, this is not directly used anymore, but other tests might need it.
const mockActualGetUserSummary = jest.fn();
jest.mock('steamapi', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserSummary: mockActualGetUserSummary,
      // getUserOwnedGames is no longer used by the /games endpoint directly
      // If other endpoints use it, it should be mocked here.
      // For now, we are focusing on the /games endpoint which uses axios.
    };
  });
});

process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db_server_steam'; // Use a distinct name
jest.mock('./config/db', () => jest.fn()); // Mock connectDB

const app = require('./server'); // Must be required after mocks

const STEAM_ID_VALID = '76561197960287930'; // A valid SteamID format

describe('Steam API Endpoints', () => {
  beforeEach(() => {
    // Reset mocks before each test
    axios.get.mockReset();
    mockSteamGameFind.mockReset();
    mockSteamGameFindOneAndUpdate.mockReset();
    mockActualGetUserSummary.mockReset(); // If testing other endpoints
    logger.error.mockClear(); // Clear logger spy
    logger.info.mockClear();
    logger.warn.mockClear();


    // Default mock for STEAM_API_KEY if not set globally for tests
    process.env.STEAM_API_KEY = 'TEST_STEAM_API_KEY';
  });

  // Tests for GET /api/steam/user/:steamid (summary) - can remain if that part of API is unchanged
  describe('GET /api/steam/user/:steamid (User Summary)', () => {
    it('should return user summary for a valid steamid', async () => {
      const mockUserSummaryData = { nickname: 'TestUser', steamID: STEAM_ID_VALID };
      mockActualGetUserSummary.mockResolvedValue(mockUserSummaryData);
      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserSummaryData);
      expect(mockActualGetUserSummary).toHaveBeenCalledWith(STEAM_ID_VALID);
    });

    it('should return 500 if steamapi.getUserSummary throws an error', async () => {
      mockActualGetUserSummary.mockRejectedValue(new Error('Steam API Error'));
      const response = await request(app).get(`/api/steam/user/invalidSteamId`);
      expect(response.status).toBe(500);
      // The error message comes from the route's error handling
      expect(response.body.error).toContain('Failed to fetch user data');
    });
  });

  // Updated tests for GET /api/steam/user/:steamid/games
  describe('GET /api/steam/user/:steamid/games (Owned Games with Cache)', () => {
    const mockGameDataFromSteam = [
      { appid: 10, name: 'Game 1', playtime_forever: 100, img_icon_url: 'icon1', img_logo_url: 'logo1' },
      { appid: 20, name: 'Game 2', playtime_forever: 200, img_icon_url: 'icon2', img_logo_url: 'logo2' },
    ];
    const mockAchievementsDataGame1 = { playerstats: { achievements: [{ name: 'ACH1', achieved: 1 }], success: true } };
    const mockAchievementsDataGame2NoStats = { playerstats: { success: false, error: "Requested app has no stats" } };


    const formattedGamesOutput = [
      { appID: 10, name: 'Game 1', playtimeForever: 100, imgIconURL: 'icon1', imgLogoURL: 'logo1', achievements: { unlocked: 1, total: 1 } },
      { appID: 20, name: 'Game 2', playtimeForever: 200, imgIconURL: 'icon2', imgLogoURL: 'logo2', achievements: { unlocked: 0, total: 0 } }, // Default if no achievements
    ];

    it('should return games from cache if available and fresh', async () => {
      const now = new Date();
      const cachedGames = formattedGamesOutput.map(g => ({ ...g, steamId: STEAM_ID_VALID, appId: g.appID, lastUpdated: now }));
      mockSteamGameFind.mockResolvedValue(cachedGames);

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(formattedGamesOutput);
      expect(mockSteamGameFind).toHaveBeenCalledWith({
        steamId: STEAM_ID_VALID,
        lastUpdated: { $gte: expect.any(Date) },
      });
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch from API, save to DB, and return games if cache is empty', async () => {
      mockSteamGameFind.mockResolvedValue([]); // Cache miss
      axios.get
        .mockResolvedValueOnce({ data: { response: { games: mockGameDataFromSteam } } }) // Owned games
        .mockResolvedValueOnce({ data: mockAchievementsDataGame1 }) // Achievements game 1
        .mockResolvedValueOnce({ data: mockAchievementsDataGame2NoStats }); // Achievements game 2 (no stats)

      mockSteamGameFindOneAndUpdate.mockImplementation(async (query, update) => {
        return {...update, ...query}; // Simulate returning the updated/inserted doc
      });

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(formattedGamesOutput);
      expect(mockSteamGameFind).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledTimes(1 + mockGameDataFromSteam.length); // 1 for games, N for achievements
      expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledTimes(mockGameDataFromSteam.length);
      mockGameDataFromSteam.forEach(game => {
        expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledWith(
          { steamId: STEAM_ID_VALID, appId: game.appid },
          expect.objectContaining({
            name: game.name,
            playtimeForever: game.playtime_forever,
            lastUpdated: expect.any(Date),
          }),
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      });
    });

    it('should fetch from API if cache is stale, save to DB, and return games', async () => {
      const staleTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const staleCachedGames = formattedGamesOutput.map(g => ({ ...g, steamId: STEAM_ID_VALID, appId: g.appID, lastUpdated: staleTimestamp }));

      // Mock find to initially return stale games, then an empty array for the specific freshness query
      // This simulates the route first checking generally, then specifically for fresh items
      mockSteamGameFind.mockImplementation(query => {
        if (query.lastUpdated && query.lastUpdated.$gte) {
          // This is the freshness query. If we want to simulate "stale", this should return []
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (query.lastUpdated.$gte.getTime() > twentyFourHoursAgo.getTime() - 10000) { // Check if the query is for fresh items
             return Promise.resolve([]); // No fresh items
          }
        }
        return Promise.resolve(staleCachedGames); // General query might return stale items
      });


      axios.get
        .mockResolvedValueOnce({ data: { response: { games: mockGameDataFromSteam } } }) // Owned games
        .mockResolvedValueOnce({ data: mockAchievementsDataGame1 })
        .mockResolvedValueOnce({ data: mockAchievementsDataGame2NoStats });

      mockSteamGameFindOneAndUpdate.mockResolvedValue({});


      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(formattedGamesOutput);
      expect(mockSteamGameFind).toHaveBeenCalledWith({
          steamId: STEAM_ID_VALID,
          lastUpdated: { $gte: expect.any(Date) }
      });
      expect(axios.get).toHaveBeenCalledTimes(1 + mockGameDataFromSteam.length);
      expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledTimes(mockGameDataFromSteam.length);
    });


    it('should handle Steam API error when fetching owned games', async () => {
      mockSteamGameFind.mockResolvedValue([]); // Cache miss
      axios.get.mockRejectedValueOnce(new Error('Steam API Down')); // Error on first axios call (owned games)

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to fetch games');
      expect(mockSteamGameFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle Steam API error when fetching achievements (and still save partial data)', async () => {
        mockSteamGameFind.mockResolvedValue([]); // Cache miss
        axios.get
            .mockResolvedValueOnce({ data: { response: { games: [mockGameDataFromSteam[0]] } } }) // Only one game for simplicity
            .mockRejectedValueOnce(new Error('Achievement API error for game 1')); // Error for achievements

        mockSteamGameFindOneAndUpdate.mockResolvedValue({});

        const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

        expect(response.status).toBe(200);
        // Expect game data, but achievements will be default { unlocked: 0, total: 0 }
        expect(response.body[0].appID).toBe(mockGameDataFromSteam[0].appid);
        expect(response.body[0].achievements).toEqual({ unlocked: 0, total: 0 });
        expect(logger.warn).toHaveBeenCalledWith(
            `Failed to fetch achievements for game ${mockGameDataFromSteam[0].appid}: Achievement API error for game 1`,
            expect.anything()
        );
        expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledTimes(1); // Still tries to save the game info
    });


    it('should proceed to API if DB read fails during cache check', async () => {
      mockSteamGameFind.mockRejectedValueOnce(new Error('DB Read Error')); // DB error on cache check
      axios.get
        .mockResolvedValueOnce({ data: { response: { games: mockGameDataFromSteam } } })
        .mockResolvedValueOnce({ data: mockAchievementsDataGame1 })
        .mockResolvedValueOnce({ data: mockAchievementsDataGame2NoStats });
      mockSteamGameFindOneAndUpdate.mockResolvedValue({});

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(formattedGamesOutput);
      expect(logger.error).toHaveBeenCalledWith('Error fetching games from MongoDB cache:', expect.anything());
      expect(axios.get).toHaveBeenCalledTimes(1 + mockGameDataFromSteam.length);
      expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledTimes(mockGameDataFromSteam.length);
    });

    it('should return API data and log error if DB write fails during save', async () => {
      mockSteamGameFind.mockResolvedValue([]); // Cache miss
      axios.get
        .mockResolvedValueOnce({ data: { response: { games: mockGameDataFromSteam } } })
        .mockResolvedValueOnce({ data: mockAchievementsDataGame1 })
        .mockResolvedValueOnce({ data: mockAchievementsDataGame2NoStats });
      mockSteamGameFindOneAndUpdate.mockRejectedValue(new Error('DB Write Error')); // Error on save

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200); // Should still return data to user
      expect(response.body).toEqual(formattedGamesOutput);
      expect(mockSteamGameFindOneAndUpdate).toHaveBeenCalledTimes(mockGameDataFromSteam.length);
      // Expect logger.error to have been called for each game that failed to save
      expect(logger.error).toHaveBeenCalledTimes(mockGameDataFromSteam.length);
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to save game ${mockGameDataFromSteam[0].appid} to MongoDB for steamId ${STEAM_ID_VALID}:`,
        expect.objectContaining({ errorMessage: 'DB Write Error' })
      );
    });
     it('should return empty array if API returns no games for user', async () => {
      mockSteamGameFind.mockResolvedValue([]); // Cache miss
      axios.get.mockResolvedValueOnce({ data: { response: { game_count: 0, games: [] } } }); // API says no games

      const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(mockSteamGameFindOneAndUpdate).not.toHaveBeenCalled(); // Nothing to save
    });

    it('should handle unexpected API response structure', async () => {
        mockSteamGameFind.mockResolvedValue([]); // Cache miss
        axios.get.mockResolvedValueOnce({ data: { unexpected_response: {} } }); // Malformed response

        const response = await request(app).get(`/api/steam/user/${STEAM_ID_VALID}/games`);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to fetch games or process data');
        expect(logger.warn).toHaveBeenCalledWith(
            'Steam API response structure was not as expected or empty.',
            expect.anything()
        );
    });


  });
});
