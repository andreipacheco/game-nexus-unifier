const request = require('supertest');
// const app = require('./server'); // Delay require app after mock is fully set up

const mockActualGetUserSummary = jest.fn();
const mockActualGetUserOwnedGames = jest.fn();

jest.mock('steamapi', () => {
  // This is the factory for the mock for the 'steamapi' module.
  // It needs to return the constructor for the SteamAPI class.
  return jest.fn().mockImplementation(() => {
    // This is the constructor of the mocked SteamAPI class.
    // It should return an object that is the instance, with methods.
    return {
      getUserSummary: mockActualGetUserSummary,
      getUserOwnedGames: mockActualGetUserOwnedGames,
    };
  });
});

// Now that the mock is set up, require the app.
// This ensures that when server.js does `new SteamAPI()`, it uses the mock above.
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db_server'; // Set dummy URI for tests
jest.mock('./config/db', () => jest.fn()); // Mock connectDB to prevent actual DB connection
const app = require('./server');

describe('Steam API Endpoints', () => {
  afterEach(() => {
    mockActualGetUserSummary.mockClear();
    mockActualGetUserOwnedGames.mockClear();
  });

  describe('GET /api/steam/user/:steamid', () => {
    it('should return user summary for a valid steamid', async () => {
      const mockUserSummaryData = { nickname: 'TestUser', steamID: '12345678901234567' };
      mockActualGetUserSummary.mockResolvedValue(mockUserSummaryData); // Configure the mock for this test

      const response = await request(app).get('/api/steam/user/12345678901234567');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserSummaryData);
      expect(mockActualGetUserSummary).toHaveBeenCalledWith('12345678901234567');
    });

    it('should return 500 if steamapi throws an error', async () => {
      mockActualGetUserSummary.mockRejectedValue(new Error('Steam API Error'));

      const response = await request(app).get('/api/steam/user/invalidSteamId');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch user data from Steam API' });
    });
  });

  describe('GET /api/steam/user/:steamid/games', () => {
    it('should return user owned games for a valid steamid', async () => {
      const mockUserGamesData = [{ appID: 10, name: 'Game 1' }];
      mockActualGetUserOwnedGames.mockResolvedValue(mockUserGamesData);

      const response = await request(app).get('/api/steam/user/12345678901234567/games');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserGamesData);
      expect(mockActualGetUserOwnedGames).toHaveBeenCalledWith('12345678901234567');
    });

    it('should return 500 if steamapi throws an error', async () => {
      mockActualGetUserOwnedGames.mockRejectedValue(new Error('Steam API Games Error'));

      const response = await request(app).get('/api/steam/user/invalidSteamId/games');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch user games from Steam API' });
    });
  });
});
