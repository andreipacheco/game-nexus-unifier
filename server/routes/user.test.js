const request = require('supertest');
const express = require('express');
const userRoutes = require('./user'); // Adjust path if necessary
const User = require('../models/User');
const PsnGame = require('../models/PsnGame');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../models/User');
jest.mock('../models/PsnGame');

// Mock ensureAuthenticated middleware
// This mock will make req.user available in the route handlers
const mockEnsureAuthenticated = (req, res, next) => {
  // Simulate an authenticated user. Adjust as needed for your tests.
  // For requests to /api/user/:userId/games, req.user.id should match :userId for success.
  req.user = { id: req.params.userId || 'testUserIdAuthenticated' };
  next();
};

const app = express();
app.use(express.json());
// Apply the mock middleware if your routes are structured to use it before the router
// Or, more directly, replace it in the router if that's how your app is built.
// For this test, we'll assume userRoutes might have ensureAuthenticated internally,
// so we ensure req.user is set up by our mockEnsureAuthenticated applied globally for these tests.
// A more robust way would be to spy on ensureAuthenticated and control its behavior if it's imported.
// For now, this simplified approach:
app.use((req, res, next) => {
    // If a specific test needs a different req.user.id than req.params.userId for auth failure tests:
    if (req.testSpecificUserId) {
        req.user = { id: req.testSpecificUserId };
    } else if (req.params.userId) {
        req.user = { id: req.params.userId }; // Simulate user accessing their own resources
    } else {
        req.user = { id: 'defaultTestUserId' }; // Default for routes not using :userId param
    }
    next();
});
app.use('/api/user', userRoutes); // Mount the user routes

describe('User Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/user/:userId/games', () => {
    it('should return PSN games for the authenticated user', async () => {
      const mockUserId = 'userWithPsnGames';
      const mockPsnGamesData = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          userId: mockUserId,
          npCommunicationId: 'psnCommId1',
          trophyTitleName: 'PSN Game 1',
          trophyTitleIconUrl: 'url1.jpg',
          platform: 'PSN',
          progress: 50,
          earnedTrophies: { bronze: 1, silver: 0, gold: 0, platinum: 0 },
          lastUpdatedFromPsn: new Date(),
          updatedAt: new Date(), // for lastPlayed mapping
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          userId: mockUserId,
          npCommunicationId: 'psnCommId2',
          trophyTitleName: 'PSN Game 2',
          trophyTitleIconUrl: 'url2.jpg',
          platform: 'PSN',
          progress: 100,
          earnedTrophies: { bronze: 10, silver: 5, gold: 2, platinum: 1 },
          lastUpdatedFromPsn: new Date(),
          updatedAt: new Date(),
        },
      ];

      PsnGame.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue(mockPsnGamesData),
      }));

      // Simulate app.use(ensureAuthenticated) for this route
      // Our global middleware already sets req.user.id = req.params.userId
      const response = await request(app).get(`/api/user/${mockUserId}/games`);

      expect(response.status).toBe(200);
      expect(PsnGame.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        // id: mockPsnGamesData[0]._id.toString(), // Schema uses game._id.toString()
        title: 'PSN Game 1',
        platform: 'PSN',
        coverImage: 'url1.jpg',
        progress: 50,
      });
      expect(response.body[1]).toMatchObject({
        // id: mockPsnGamesData[1]._id.toString(),
        title: 'PSN Game 2',
        platform: 'PSN',
        coverImage: 'url2.jpg',
        progress: 100,
      });
      // Check the mapped 'id' field specifically
      expect(response.body[0].id).toBe(mockPsnGamesData[0]._id.toString());
      expect(response.body[1].id).toBe(mockPsnGamesData[1]._id.toString());
    });

    it('should return an empty array if no games are found for the user', async () => {
      const mockUserId = 'userWithNoGames';
      PsnGame.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue([]),
      }));

      const response = await request(app).get(`/api/user/${mockUserId}/games`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(PsnGame.find).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should return 403 Forbidden if user tries to access another user\'s games', async () => {
      const targetUserId = 'anotherUser';
      const authenticatedUserId = 'testUserTryingToAccess';

      // For this test, we need req.user.id to be different from req.params.userId
      // We'll modify the request processing slightly for this test by adding a property
      // that our test-specific middleware will pick up.
      const tempApp = express();
      tempApp.use(express.json());
      tempApp.use((req, res, next) => {
        req.user = { id: authenticatedUserId }; // Authenticated as this user
        next();
      });
      tempApp.use('/api/user', userRoutes);


      const response = await request(tempApp).get(`/api/user/${targetUserId}/games`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Forbidden: You can only access your own games.');
      // Ensure PsnGame.find was not called in this case, as auth should fail first
      expect(PsnGame.find).not.toHaveBeenCalled();
    });

    it('should return 500 if there is a database error', async () => {
        const mockUserId = 'userWithDbError';
        PsnGame.find.mockImplementation(() => ({
            lean: jest.fn().mockRejectedValue(new Error('Database connection error')),
        }));

        const response = await request(app).get(`/api/user/${mockUserId}/games`);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('An error occurred while fetching games.');
    });
  });

  // TODO: Add tests for other user routes like /me and /change-password if not already covered elsewhere.
  // For now, this file focuses on the /:userId/games endpoint as per the subtask.
});
