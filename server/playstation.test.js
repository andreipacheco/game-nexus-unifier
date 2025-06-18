import request from 'supertest';
import app from '../server.js'; // Adjust if your app is exported differently
import { jest } from '@jest/globals'; // Required for jest.mock

// Mock the psn-api module
// We need to provide a manual mock for psn-api since it's likely an ESM module
// and we're in a CommonJS-like Jest environment (or need to be explicit).
const mockExchangeNpssoForAccessCode = jest.fn();
const mockExchangeAccessCodeForAuthTokens = jest.fn();
const mockGetUserTitles = jest.fn();

jest.mock('psn-api', () => ({
  exchangeNpssoForAccessCode: mockExchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens: mockExchangeAccessCodeForAuthTokens,
  getUserTitles: mockGetUserTitles,
}));

// Mock logger to prevent actual logging during tests and optionally assert on it
jest.mock('../utils/logger.js', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));


describe('POST /api/playstation/user/games', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockExchangeNpssoForAccessCode.mockReset();
    mockExchangeAccessCodeForAuthTokens.mockReset();
    mockGetUserTitles.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return user games on successful API calls', async () => {
    const mockNpsso = 'test-npsso-token';
    const mockAccessCode = 'test-access-code';
    const mockAuthTokens = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' };
    const mockGameData = {
      trophyTitles: [
        { npCommunicationId: 'NPWR12345_00', trophyTitleName: 'Test Game 1', trophyTitleIconUrl: 'url1', trophyTitlePlatform: 'PS5' },
        { npCommunicationId: 'NPWR67890_00', trophyTitleName: 'Test Game 2', trophyTitleIconUrl: 'url2', trophyTitlePlatform: 'PS4' },
      ],
      totalItemCount: 2
    };

    mockExchangeNpssoForAccessCode.mockResolvedValue(mockAccessCode);
    mockExchangeAccessCodeForAuthTokens.mockResolvedValue(mockAuthTokens);
    mockGetUserTitles.mockResolvedValue(mockGameData);

    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({ npsso: mockNpsso });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockGameData);
    expect(mockExchangeNpssoForAccessCode).toHaveBeenCalledWith(mockNpsso);
    expect(mockExchangeAccessCodeForAuthTokens).toHaveBeenCalledWith(mockAccessCode);
    expect(mockGetUserTitles).toHaveBeenCalledWith({ accessToken: mockAuthTokens.accessToken }, "me");
  });

  it('should return 400 if NPSSO token is missing', async () => {
    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('NPSSO token is required');
    expect(mockExchangeNpssoForAccessCode).not.toHaveBeenCalled();
  });

  it('should return 401 if exchangeNpssoForAccessCode fails due to invalid NPSSO', async () => {
    const mockNpsso = 'invalid-npsso-token';
    mockExchangeNpssoForAccessCode.mockRejectedValue(new Error('Invalid NPSSO token from psn-api'));

    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({ npsso: mockNpsso });

    expect(response.status).toBe(401); // Based on error handling in route
    expect(response.body.error).toMatch(/Invalid or expired NPSSO token/i);
    expect(mockExchangeNpssoForAccessCode).toHaveBeenCalledWith(mockNpsso);
    expect(mockExchangeAccessCodeForAuthTokens).not.toHaveBeenCalled();
  });

  it('should return 500 if exchangeNpssoForAccessCode fails for other reasons', async () => {
    const mockNpsso = 'test-npsso-token';
    mockExchangeNpssoForAccessCode.mockRejectedValue(new Error('Some other API error'));

    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({ npsso: mockNpsso });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/Playstation API error: Some other API error/i);
    expect(mockExchangeNpssoForAccessCode).toHaveBeenCalledWith(mockNpsso);
    expect(mockExchangeAccessCodeForAuthTokens).not.toHaveBeenCalled();
  });


  it('should return 500 if exchangeAccessCodeForAuthTokens fails', async () => {
    const mockNpsso = 'test-npsso-token';
    const mockAccessCode = 'test-access-code';
    mockExchangeNpssoForAccessCode.mockResolvedValue(mockAccessCode);
    mockExchangeAccessCodeForAuthTokens.mockRejectedValue(new Error('Failed to get auth tokens'));

    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({ npsso: mockNpsso });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/Playstation API error: Failed to get auth tokens/i);
    expect(mockExchangeNpssoForAccessCode).toHaveBeenCalledWith(mockNpsso);
    expect(mockExchangeAccessCodeForAuthTokens).toHaveBeenCalledWith(mockAccessCode);
    expect(mockGetUserTitles).not.toHaveBeenCalled();
  });

  it('should return 500 if getUserTitles fails', async () => {
    const mockNpsso = 'test-npsso-token';
    const mockAccessCode = 'test-access-code';
    const mockAuthTokens = { accessToken: 'test-access-token' };
    mockExchangeNpssoForAccessCode.mockResolvedValue(mockAccessCode);
    mockExchangeAccessCodeForAuthTokens.mockResolvedValue(mockAuthTokens);
    mockGetUserTitles.mockRejectedValue(new Error('Failed to get user titles'));

    const response = await request(app)
      .post('/api/playstation/user/games')
      .send({ npsso: mockNpsso });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/Playstation API error: Failed to get user titles/i);
    expect(mockGetUserTitles).toHaveBeenCalledWith({ accessToken: mockAuthTokens.accessToken }, "me");
  });
});
