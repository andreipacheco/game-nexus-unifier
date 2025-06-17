const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const passport = require('passport'); // Actual passport instance from app
const User = require('./models/User'); // Actual User model
const app = require('./server'); // Load app AFTER other setups
const logger = require('./config/logger');

// Mock logger to suppress output during tests
jest.mock('./config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

// Mock parts of passportConfig for finer control if needed, or mock strategies directly
// jest.mock('./config/passportConfig'); // May not be needed if testing strategy interaction

let mongoServer;

// Test environment variables
process.env.STEAM_API_KEY = 'test_steam_api_key_passport';
process.env.APP_BASE_URL = 'http://localhost:5173'; // For redirects
process.env.SESSION_SECRET = 'test_session_secret_for_auth_test';
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET will be used by the actual strategy
// We don't need to set them if we are mocking the strategy's verify callback behavior
// or if the strategy is configured not to run in test if they are missing (via logger.warn)

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri; // Use in-memory DB for tests
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all data after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  jest.clearAllMocks(); // Clear all jest mocks
});


describe('Auth Endpoints', () => {

  describe('Google OAuth', () => {
    const MOCK_GOOGLE_PROFILE = {
      id: 'googleTestId123',
      displayName: 'Google Test User',
      emails: [{ value: 'google.test@example.com', verified: true }],
      photos: [{ value: 'google_avatar_url.jpg' }],
    };

    describe('GET /auth/google', () => {
      it('should redirect to Google for authentication', async () => {
        const response = await request(app).get('/auth/google');
        expect(response.status).toBe(302);
        // The actual location will be Google's OAuth URL, which is complex.
        // Checking for a redirect is often sufficient for this part.
        // Or, check that the location includes 'accounts.google.com'
        expect(response.header.location).toContain('accounts.google.com');
      });
    });

    describe('GET /auth/google/callback', () => {
      // To test the callback, we need to simulate what passport.authenticate would do
      // after Google redirects back. Specifically, it would invoke our verify callback.
      // We can mock `passport.authenticate` to directly call our route handler
      // as if authentication was successful or failed.

      // For callback tests, we want the actual strategy's verify callback to run.
      // We can mock the method within the GoogleStrategy that fetches the user profile.
      // This is typically `userProfile(accessToken, done)`.
      // We'll make it call `done(null, MOCK_GOOGLE_PROFILE)`.

      let googleStrategyUserProfileSpy;

      beforeEach(() => {
        // Ensure passport has the GoogleStrategy initialized.
        // The 'google' strategy is named in passportConfig.js.
        // We need to access the actual strategy instance used by passport.
        // This can be tricky. A common way is to access `passport._strategies.google`.
        // However, `_strategies` is not a public API.
        // A more robust way if the strategy is a singleton or if we can get a handle to it:
        // const GoogleStrategy = require('passport-google-oauth20').Strategy;
        // googleStrategyUserProfileSpy = jest.spyOn(GoogleStrategy.prototype, 'userProfile')
        // This mocks it for all instances.

        // For this test, we will mock `passport.authenticate` to simulate the strategy's verify callback
        // being called with our mock profile, allowing our verify callback logic in `passportConfig.js` to execute.
        // This is a compromise to avoid deep strategy mocking.
        jest.spyOn(passport, 'authenticate').mockImplementation((strategyName, options, callbackOrHandler) => {
          if (strategyName === 'google') {
            return async (req, res, next) => {
              // Simulate the part of passport that calls the verify callback
              // This requires finding the verify callback registered in passportConfig.js
              // This is complex. Let's simplify the test's responsibility.

              // Simplified: We assume passport calls our verify callback from passportConfig.js
              // and that callback then correctly finds/creates a user.
              // The test will then check the outcome (DB state, redirect, session).
              // To make this work, the verify callback in passportConfig needs to be "tricked"
              // into receiving MOCK_GOOGLE_PROFILE when it expects a profile from Google.

              // If we can't easily mock the profile provided *to* the verify callback,
              // we'll have to mock the outcome *of* the verify callback as it affects `req.user`.
              // This was the previous approach. Let's refine it.

              // The key is that `passport.authenticate()` for the callback route eventually calls `req.logIn()`.
              // `req.logIn` then calls `passport.serializeUser()`.
              // The route handler `(req, res) => res.redirect(...)` is called after `req.logIn` succeeds.

              // Let's mock the user being successfully processed by the verify callback and passed to req.logIn
              // This means the DB interaction part of the test needs to be done *before* this mock.
              // This is still not ideal as it doesn't test the verify callback logic itself.

              // A better way:
              // Mock the `Strategy.prototype._verify` or a similar method if available,
              // or the method that *calls* our verify callback.
              // Given the constraints, we will test the effect of the verify callback.
              // The `passport.authenticate` middleware will eventually call our verify callback.
              // If the verify callback successfully calls `done(null, user)`, passport then calls `req.login`.
              // We will simulate this by ensuring the user is in the DB as if the verify callback worked,
              // then mock `req.login` or check its effects.

              // This test focuses on the callback route handler's behavior after successful strategy execution.
              // The actual verify callback logic (user creation/finding in DB) will be tested more directly
              // by the DB assertions after the request.

              // To allow the actual verify callback to run with mock data, we need to effectively
              // mock the part of the Google strategy that provides the profile to our callback.
              // This is tricky without direct access to the strategy instance or its internals.

              // Let's assume for these tests that the verify callback in passportConfig.js
              // is working correctly and we are testing the surrounding Express route logic.
              // We will manually create/find user in the test setup to simulate the verify callback's DB work,
              // then check if the route correctly redirects and sets a session.

              if (req.testBehavior === 'googleAuthSuccess_newUser') {
                // DB interaction (user creation) must have happened as if by verify callback
                // We'll assert this *after* the call.
                // Here, we simulate that passport has processed it and is ready to redirect.
                req.user = { _id: 'mockNewUserId', email: MOCK_GOOGLE_PROFILE.emails[0].value, ...MOCK_GOOGLE_PROFILE };
                res.redirect(`${process.env.APP_BASE_URL}/dashboard?google_login_success=true`);
              } else if (req.testBehavior === 'googleAuthSuccess_existingUser') {
                req.user = { _id: req.preExistingUser._id, ...req.preExistingUser };
                res.redirect(`${process.env.APP_BASE_URL}/dashboard?google_login_success=true`);
              } else if (req.testBehavior === 'googleAuthFailure') {
                res.redirect(options.failureRedirect);
              } else {
                next(new Error('Test behavior not set for Google auth callback'));
              }
            };
          }
          // Fallback for other strategies or unmocked behavior
          const actualAuthenticate = jest.requireActual('passport').authenticate;
          return actualAuthenticate(strategyName, options, callbackOrHandler)(req, res, next);
        });
      });

      afterEach(() => {
        jest.restoreAllMocks(); // Restores all mocks, including passport.authenticate
      });

      it('should create a new user, establish session, and redirect to dashboard on successful new Google auth', async () => {
        // This test now relies on the verify callback in passportConfig.js to actually create the user.
        // To make that happen, we need to ensure the MOCK_GOOGLE_PROFILE is somehow passed to it.
        // This is the hardest part to mock correctly.
        // For now, the above mock of passport.authenticate bypasses the actual verify callback logic for DB.
        // The DB assertions below will FAIL with the current mock.

        // To truly test the verify callback:
        // 1. The `passport.authenticate` mock needs to be more sophisticated.
        // It should call the *actual* verify callback from `passportConfig.js`
        // after providing it with `MOCK_GOOGLE_PROFILE`.

        // A pragmatic approach for now:
        // We will assume the environment is set up such that passport calls our verify callback.
        // We will mock `GoogleStrategy.prototype._oauth2.get` which is often used to get the user profile.
        const GoogleStrategy = require('passport-google-oauth20').Strategy;
        const getProfileSpy = jest.spyOn(GoogleStrategy.prototype, '_oauth2', 'get');
        getProfileSpy.mockImplementation((url, accessToken, callback) => {
            // Simulate fetching profile from Google
            callback(null, JSON.stringify(MOCK_GOOGLE_PROFILE), null);
        });
        // Also need to mock getOAuthAccessToken if it's called before userProfile
        const getOAuthAccessTokenSpy = jest.spyOn(GoogleStrategy.prototype._oauth2, 'getOAuthAccessToken');
        getOAuthAccessTokenSpy.mockImplementation((code, params, callback) => {
            callback(null, 'mock-access-token', 'mock-refresh-token', { /* params */ });
        });


        const response = await request(app).get('/auth/google/callback?code=mock_google_code');

        expect(response.status).toBe(302); // Route should redirect
        expect(response.header.location).toBe(`${process.env.APP_BASE_URL}/dashboard?google_login_success=true`); // Check redirect URL

        const dbUser = await User.findOne({ googleId: MOCK_GOOGLE_PROFILE.id });
        expect(dbUser).not.toBeNull(); // User should be created
        expect(dbUser.email).toBe(MOCK_GOOGLE_PROFILE.emails[0].value);
        expect(dbUser.name).toBe(MOCK_GOOGLE_PROFILE.displayName);

        expect(response.header['set-cookie']).toBeDefined(); // Session cookie should be set
        expect(response.header['set-cookie'].some(cookie => cookie.startsWith('connect.sid='))).toBe(true);

        getProfileSpy.mockRestore();
        getOAuthAccessTokenSpy.mockRestore();
      });

      it('should log in an existing Google user, update details, establish session, and redirect', async () => {
        const oldName = 'Old Google Name';
        await new User({ // Pre-populate DB
            googleId: MOCK_GOOGLE_PROFILE.id,
            email: 'old.email@example.com', // Old email
            name: oldName,
        }).save();

        const GoogleStrategy = require('passport-google-oauth20').Strategy;
        const getProfileSpy = jest.spyOn(GoogleStrategy.prototype, '_oauth2', 'get');
        getProfileSpy.mockImplementation((url, accessToken, callback) => {
            callback(null, JSON.stringify(MOCK_GOOGLE_PROFILE), null);
        });
        const getOAuthAccessTokenSpy = jest.spyOn(GoogleStrategy.prototype._oauth2, 'getOAuthAccessToken');
        getOAuthAccessTokenSpy.mockImplementation((code, params, callback) => {
            callback(null, 'mock-access-token', 'mock-refresh-token', {});
        });

        const response = await request(app).get('/auth/google/callback?code=mock_google_code');
        expect(response.status).toBe(302);
        expect(response.header.location).toBe(`${process.env.APP_BASE_URL}/dashboard?google_login_success=true`);

        const dbUser = await User.findOne({ googleId: MOCK_GOOGLE_PROFILE.id });
        expect(dbUser).not.toBeNull();
        expect(dbUser.name).toBe(MOCK_GOOGLE_PROFILE.displayName); // Name should be updated
        expect(dbUser.email).toBe(MOCK_GOOGLE_PROFILE.emails[0].value); // Email should be updated
        expect(response.header['set-cookie']).toBeDefined();
      });


      it('should link Google account to an existing user (by email), establish session, and redirect', async () => {
        const existingEmailUserName = 'Email User Name';
        await new User({ // Pre-populate DB with user having only email
            email: MOCK_GOOGLE_PROFILE.emails[0].value,
            name: existingEmailUserName,
        }).save();

        const GoogleStrategy = require('passport-google-oauth20').Strategy;
        const getProfileSpy = jest.spyOn(GoogleStrategy.prototype, '_oauth2', 'get');
        getProfileSpy.mockImplementation((url, accessToken, callback) => {
            callback(null, JSON.stringify(MOCK_GOOGLE_PROFILE), null);
        });
         const getOAuthAccessTokenSpy = jest.spyOn(GoogleStrategy.prototype._oauth2, 'getOAuthAccessToken');
        getOAuthAccessTokenSpy.mockImplementation((code, params, callback) => {
            callback(null, 'mock-access-token', 'mock-refresh-token', {});
        });

        const response = await request(app).get('/auth/google/callback?code=mock_google_code');
        expect(response.status).toBe(302);
        expect(response.header.location).toBe(`${process.env.APP_BASE_URL}/dashboard?google_login_success=true`);

        const dbUser = await User.findOne({ email: MOCK_GOOGLE_PROFILE.emails[0].value });
        expect(dbUser).not.toBeNull();
        expect(dbUser.googleId).toBe(MOCK_GOOGLE_PROFILE.id); // Google ID should be linked
        expect(dbUser.name).toBe(MOCK_GOOGLE_PROFILE.displayName); // Name should be updated from Google profile
        expect(response.header['set-cookie']).toBeDefined();

        getProfileSpy.mockRestore();
        getOAuthAccessTokenSpy.mockRestore();
      });

      it('should redirect to failureRedirect if Google authentication fails', async () => {
        passportAuthenticateSpy.mockImplementation((strategy, options) => {
          if (strategy === 'google') {
            return (req, res, next) => {
              // Simulate authentication failure by redirecting to the failure route
              // The actual passport middleware would handle this.
              res.redirect(options.failureRedirect);
            };
          }
          return (req, res, next) => next();
        });

        const response = await request(app).get('/auth/google/callback?error=access_denied');
        expect(response.status).toBe(302);
        expect(response.header.location).toBe(`${process.env.APP_BASE_URL || '/'}/login?error=google_auth_failed`);
      });
    });
  });

  describe('Local Email/Password Auth', () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };
    const lowercasedEmail = userData.email.toLowerCase();

    describe('POST /auth/register', () => {
      it('should register a new user successfully and establish a session', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send(userData);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Registration successful. User logged in.');
        expect(response.body.user.email).toBe(lowercasedEmail);
        expect(response.body.user.name).toBe(userData.name);
        expect(response.body.user).not.toHaveProperty('password');
        expect(response.header['set-cookie']).toBeDefined(); // Session cookie
        expect(response.header['set-cookie'].some(cookie => cookie.startsWith('connect.sid='))).toBe(true);

        const dbUser = await User.findOne({ email: lowercasedEmail });
        expect(dbUser).not.toBeNull();
        expect(dbUser.name).toBe(userData.name);
        expect(dbUser.password).toBeDefined();
        expect(dbUser.password).not.toBe(userData.password); // Should be hashed
      });

      it('should return 409 if email already exists', async () => {
        await new User({ email: lowercasedEmail, password: 'anotherPassword' }).save();
        const response = await request(app)
          .post('/auth/register')
          .send(userData);
        expect(response.status).toBe(409);
        expect(response.body.message).toBe('User already exists with this email.');
      });

      it('should return 400 for missing email', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({ name: userData.name, password: userData.password });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Email and password are required.');
      });

      it('should return 400 for missing password', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({ name: userData.name, email: userData.email });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Email and password are required.');
      });

      it('should return 400 for short password', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({ ...userData, password: 'short' });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Password must be at least 8 characters long.');
      });
    });

    describe('POST /auth/login', () => {
      let agent;
      beforeEach(async () => {
        agent = request.agent(app); // Use agent to persist session cookies
        // Create a user to login with
        const user = new User(userData); // Password will be hashed by pre-save hook
        await user.save();
      });

      it('should login an existing user successfully and establish a session', async () => {
        const response = await agent
          .post('/auth/login')
          .send({ email: userData.email, password: userData.password });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
        expect(response.body.user.email).toBe(lowercasedEmail);
        expect(response.body.user).not.toHaveProperty('password');
        expect(response.header['set-cookie']).toBeDefined();
        expect(response.header['set-cookie'].some(cookie => cookie.startsWith('connect.sid='))).toBe(true);

        // Check if lastLoginAt was updated (optional, but good)
        const dbUser = await User.findOne({ email: lowercasedEmail });
        expect(dbUser.lastLoginAt).toBeDefined();
      });

      it('should return 401 for incorrect password', async () => {
        const response = await agent
          .post('/auth/login')
          .send({ email: userData.email, password: 'wrongPassword' });
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid email or password.');
      });

      it('should return 401 for non-existent email', async () => {
        const response = await agent
          .post('/auth/login')
          .send({ email: 'nonexistent@example.com', password: userData.password });
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid email or password.');
      });

      it('should return 401 for a user with no local password (e.g., OAuth only)', async () => {
        await User.create({
          email: 'oauthonly@example.com',
          name: 'OAuth User',
          googleId: 'google12345',
          // no password field
        });
        const response = await agent
          .post('/auth/login')
          .send({ email: 'oauthonly@example.com', password: 'anypassword' });
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Account exists but has no local password. Try OAuth or set a password.');
      });
    });
  });

  // TODO: Adapt Steam tests similarly if time permits.

  describe('GET /auth/logout', () => {
    it('should log out the user and redirect to home', async () => {
      // For logout, agent needs to be "logged in" first.
      // We can achieve this by first registering/logging in a user with the agent.
      const agent = request.agent(app);
      await agent.post('/auth/register').send({
        name: 'Logout Test User',
        email: 'logout@example.com',
        password: 'password123'
      });
      // Now agent has a session.

      // Simulate a login first (simplified - assuming a session can be established)
      // For a real test of logout, you'd typically perform a login operation with the agent first.
      // Here, we'll rely on the fact that if a user *was* logged in, logout clears session.

      // Mock user for save operation if lastLogoutAt is updated
      User.findById = jest.fn().mockResolvedValue({
        _id: 'someUserId',
        save: jest.fn().mockResolvedValue(true)
      });

      const response = await agent.get('/auth/logout');
      expect(response.status).toBe(302);
      expect(response.header.location).toBe(process.env.APP_BASE_URL || '/');
      // Check if 'connect.sid' cookie is cleared or expired
      const setCookieHeader = response.header['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader.some(cookie => cookie.startsWith('connect.sid=;') || cookie.includes('Max-Age=0'))).toBe(true);
    });
  });

});
