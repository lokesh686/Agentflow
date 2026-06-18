const express = require('express');
const passport = require('passport');
const { authLimiter } = require('../middleware/rateLimiter');
require('../config/passport'); // Initialize passport strategy

const router = express.Router();

function getMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

// Google OAuth Entry
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }), async (req, res, next) => {
  try {
    const user = req.user;
    const { issueAccessToken, issueRefreshToken } = require('../utils/jwt');
    const RefreshToken = require('../models/RefreshToken');
    const AuditLog = require('../models/AuditLog');

    const accessToken = issueAccessToken(user);
    const { token: refreshToken, hash } = issueRefreshToken(user._id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      tokenHash: hash,
      userId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt,
    });

    await AuditLog.create({
      userId: user._id,
      teamId: user.teamId,
      event: 'oauth_login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta: { provider: 'google' },
    });

    // Send tokens to frontend via redirect (hash fragment)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/oauth/github
 * Body: { code: string }  — GitHub OAuth authorization code
 */
router.post('/github', authLimiter, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'code is required' });

    const profile = await verifyGithubCode(code);
    const result = await oauthLogin(profile, getMeta(req));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
