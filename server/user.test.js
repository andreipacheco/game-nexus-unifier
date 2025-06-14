const request = require('supertest');
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db_user'; // Set dummy URI

// Mock SteamAPI (even if not directly used by user routes, server.js imports it)
const mockUserTestGetUserSummary = jest.fn(); // Dummy mock fn
jest.mock('steamapi', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserSummary: mockUserTestGetUserSummary,
      // Add any other methods that might be called during server setup if any
    };
  });
});

jest.mock('./config/db', () => jest.fn()); // Mock connectDB
jest.mock('./models/User');

const app = require('./server'); // Corrected path - require app AFTER mocks
const User = require('./models/User'); // User model itself (mocked above) for type hints or static methods if any

describe('User API Endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/user/steam_profile', () => {
    it('should return user profile if steamid is valid and user exists', async () => {
      const mockUser = {
        steamId: '12345',
        personaName: 'Test User',
        avatar: 'avatar_url.jpg',
        profileUrl: 'profile_url_here',
      };
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app).get('/api/user/steam_profile?steamid=12345');

      expect(response.status).toBe(200);
      expect(User.findOne).toHaveBeenCalledWith({ steamId: '12345' });
      expect(response.body).toEqual({
        steamId: mockUser.steamId,
        personaName: mockUser.personaName,
        avatarFull: mockUser.avatar, // Matches the field name in the route's response
        profileUrl: mockUser.profileUrl,
      });
    });

    it('should return 404 if user is not found', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app).get('/api/user/steam_profile?steamid=nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found with the provided SteamID.' });
    });

    it('should return 400 if steamid query parameter is missing', async () => {
      const response = await request(app).get('/api/user/steam_profile');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'SteamID query parameter is required.' });
    });

    it('should return 500 if there is a database error', async () => {
      User.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/user/steam_profile?steamid=12345');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error while fetching user profile.' });
    });
  });
});
