/**
 * Auth Routes — Integration Tests
 *
 * Run: npm test --workspace=apps/api-gateway
 *
 * These tests use an in-memory MongoDB (mongodb-memory-server) so they are
 * fully self-contained and do not require a running database.
 *
 * Email sending is mocked so no real SMTP credentials are needed.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock email utility — prevents real SMTP calls in tests
jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined),
}));

// Mock Redis — no real Redis needed for auth tests
jest.mock('../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  getRedis: jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  }),
}));

let app;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET_PRIVATE = 'test-secret-key-do-not-use-in-prod';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';

  // Import app after env is set
  app = require('../index');
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── Test data ──────────────────────────────────────────────────────────────

const validUser = {
  name: 'Lokesh Dev',
  email: 'lokesh@agentflow.test',
  password: 'Str0ngP@ssword!',
};

// ─── Register ───────────────────────────────────────────────────────────────

describe('POST /v1/auth/register', () => {
  it('creates a new user and team', async () => {
    const res = await request(app).post('/v1/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.team).toBeDefined();
    expect(res.body.data.team.ownerId).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/v1/auth/register').send(validUser);
    const res = await request(app).post('/v1/auth/register').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ ...validUser, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

// ─── Login ──────────────────────────────────────────────────────────────────

describe('POST /v1/auth/login', () => {
  beforeEach(async () => {
    // Register and manually verify the user so login works
    await request(app).post('/v1/auth/register').send(validUser);
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: validUser.email }, { verified: true });
  });

  it('returns access + refresh tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: 'WrongPassword99' });
    expect(res.status).toBe(401);
  });

  it('rejects unverified user', async () => {
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: validUser.email }, { verified: false });
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(403);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'nobody@agentflow.test', password: validUser.password });
    expect(res.status).toBe(401);
  });
});

// ─── Token Refresh ──────────────────────────────────────────────────────────

describe('POST /v1/auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    await request(app).post('/v1/auth/register').send(validUser);
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: validUser.email }, { verified: true });
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    refreshToken = loginRes.body.data.refreshToken;
  });

  it('issues new token pair on valid refresh token', async () => {
    const res = await request(app).post('/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // New refresh token should be different (rotation)
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('rejects a reused refresh token (rotation enforcement)', async () => {
    await request(app).post('/v1/auth/refresh').send({ refreshToken });
    const res = await request(app).post('/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('rejects missing refresh token', async () => {
    const res = await request(app).post('/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Email Verification ─────────────────────────────────────────────────────

describe('GET /v1/auth/verify-email', () => {
  it('verifies email with valid token', async () => {
    await request(app).post('/v1/auth/register').send(validUser);
    const User = require('../models/User');
    const user = await User.findOne({ email: validUser.email });
    const token = user.verificationToken;

    const res = await request(app).get(`/v1/auth/verify-email?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findOne({ email: validUser.email });
    expect(updated.verified).toBe(true);
  });

  it('rejects invalid token', async () => {
    const res = await request(app).get('/v1/auth/verify-email?token=invalid-token');
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app).get('/v1/auth/verify-email');
    expect(res.status).toBe(400);
  });
});

// ─── Password Reset ─────────────────────────────────────────────────────────

describe('Password reset flow', () => {
  beforeEach(async () => {
    await request(app).post('/v1/auth/register').send(validUser);
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: validUser.email }, { verified: true });
  });

  it('returns success even for unknown email (no user enumeration)', async () => {
    const res = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'unknown@agentflow.test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('resets password with valid token and allows login with new password', async () => {
    // Request reset
    await request(app).post('/v1/auth/forgot-password').send({ email: validUser.email });
    const User = require('../models/User');
    const user = await User.findOne({ email: validUser.email });
    const resetToken = user.passwordResetToken;

    // Reset password
    const newPassword = 'NewStr0ngP@ss!';
    const resetRes = await request(app)
      .post('/v1/auth/reset-password')
      .send({ token: resetToken, password: newPassword });
    expect(resetRes.status).toBe(200);

    // Login with new password
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();
  });
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe('GET /v1/auth/me', () => {
  it('returns current user when authenticated', async () => {
    await request(app).post('/v1/auth/register').send(validUser);
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: validUser.email }, { verified: true });
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
