const request = require('supertest');
const express = require('express');
const psnRoutes = require('./psn'); // Adjust path as necessary
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getUserTrophyProfileSummary
} = require('psn-api');

// Mock the psn-api module
jest.mock('psn-api', () => ({
  exchangeNpssoForAccessCode: jest.fn(),
  exchangeAccessCodeForAuthTokens: jest.fn(),
  getUserTitles: jest.fn(),
  getUserTrophyProfileSummary: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/psn', psnRoutes);

describe('PSN API Routes', () => {
  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  describe('POST /api/psn/initiate-auth', () => {
    it('should exchange NPSSO for access code successfully', async () => {
      exchangeNpssoForAccessCode.mockResolvedValue('mockAccessCode');
      const response = await request(app)
        .post('/api/psn/initiate-auth')
        .send({ npsso: 'testNpssoToken' });
      expect(response.status).toBe(200);
      expect(response.body.accessCode).toBe('mockAccessCode');
      expect(exchangeNpssoForAccessCode).toHaveBeenCalledWith('testNpssoToken');
    });

    it('should return 400 if NPSSO token is missing', async () => {
      const response = await request(app)
        .post('/api/psn/initiate-auth')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('NPSSO token is required.');
    });

    it('should return 500 if exchangeNpssoForAccessCode fails', async () => {
      exchangeNpssoForAccessCode.mockRejectedValue(new Error('PSN API Error'));
      const response = await request(app)
        .post('/api/psn/initiate-auth')
        .send({ npsso: 'testNpssoToken' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to exchange NPSSO for access code.');
    });
  });

  describe('POST /api/psn/exchange-code', () => {
    it('should exchange access code for auth tokens successfully', async () => {
      const mockAuth = { accessToken: 'mockAccessToken', refreshToken: 'mockRefreshToken' };
      exchangeAccessCodeForAuthTokens.mockResolvedValue(mockAuth);
      const response = await request(app)
        .post('/api/psn/exchange-code')
        .send({ accessCode: 'testAccessCode' });
      expect(response.status).toBe(200);
      expect(response.body.authorization).toEqual(mockAuth);
      expect(exchangeAccessCodeForAuthTokens).toHaveBeenCalledWith('testAccessCode');
    });

    it('should return 400 if access code is missing', async () => {
      const response = await request(app)
        .post('/api/psn/exchange-code')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Access code is required.');
    });

    it('should return 500 if exchangeAccessCodeForAuthTokens fails', async () => {
      exchangeAccessCodeForAuthTokens.mockRejectedValue(new Error('PSN API Error'));
      const response = await request(app)
        .post('/api/psn/exchange-code')
        .send({ accessCode: 'testAccessCode' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to exchange access code for auth tokens.');
    });
  });

  describe('GET /api/psn/games', () => {
    it('should fetch user game titles successfully', async () => {
      const mockGameTitles = { trophyTitles: [], totalItemCount: 0 };
      getUserTitles.mockResolvedValue(mockGameTitles);
      const response = await request(app)
        .get('/api/psn/games')
        .set('Authorization', 'Bearer testAccessToken');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockGameTitles);
      expect(getUserTitles).toHaveBeenCalledWith({ accessToken: 'testAccessToken' }, 'me');
    });

    it('should return 401 if access token is missing', async () => {
      const response = await request(app).get('/api/psn/games');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token is required.');
    });

    it('should return 500 if getUserTitles fails', async () => {
      getUserTitles.mockRejectedValue(new Error('PSN API Error'));
      const response = await request(app)
        .get('/api/psn/games')
        .set('Authorization', 'Bearer testAccessToken');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user game titles.');
    });
  });

  describe('GET /api/psn/trophy-summary', () => {
    it('should fetch user trophy summary successfully', async () => {
      const mockTrophySummary = { accountId: '123', trophyLevel: 100 };
      getUserTrophyProfileSummary.mockResolvedValue(mockTrophySummary);
      const response = await request(app)
        .get('/api/psn/trophy-summary')
        .set('Authorization', 'Bearer testAccessToken');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTrophySummary);
      expect(getUserTrophyProfileSummary).toHaveBeenCalledWith({ accessToken: 'testAccessToken' }, 'me');
    });

    it('should return 401 if access token is missing', async () => {
      const response = await request(app).get('/api/psn/trophy-summary');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token is required.');
    });

    it('should return 500 if getUserTrophyProfileSummary fails', async () => {
      getUserTrophyProfileSummary.mockRejectedValue(new Error('PSN API Error'));
      const response = await request(app)
        .get('/api/psn/trophy-summary')
        .set('Authorization', 'Bearer testAccessToken');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user trophy summary.');
    });
  });
});
