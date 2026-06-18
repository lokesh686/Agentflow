const express = require('express');
const Joi = require('joi');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── Validation schemas ────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const forgotSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

const resetSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required(),
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });
    req.body = value;
    next();
  };
}

function getMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /v1/auth/register
 * Create account + team, send verification email
 */
router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register({ name, email, password }, getMeta(req));
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        team: result.team,
        message: 'Registration successful. Please check your email to verify your account.',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/login
 * Returns access token + refresh token
 */
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login({ email, password }, getMeta(req));
    res.json({
      success: true,
      data: { user, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/refresh
 * Rotate refresh token, issue new access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }
    const tokens = await authService.refreshTokens(refreshToken, getMeta(req));
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/logout
 * Revoke refresh token
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken, req.user.sub);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/auth/verify-email?token=...
 * Confirm email address
 */
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'token is required' });
    const result = await authService.verifyEmail(token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', authLimiter, validate(forgotSchema), async (req, res, next) => {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/reset-password
 * Set a new password using reset token
 */
router.post('/reset-password', authLimiter, validate(resetSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/auth/me
 * Return current user from token
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { user: user.toPublic() } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
