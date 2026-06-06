const express = require('express');
const { oauthLogin, verifyGoogleToken, verifyGithubCode } = require('../services/oauthService');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

function getMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

/**
 * POST /v1/auth/oauth/google
 * Body: { idToken: string }  — Google ID token from @react-oauth/google
 */
router.post('/google', authLimiter, async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, error: 'idToken is required' });

    const profile = await verifyGoogleToken(idToken);
    const result = await oauthLogin(profile, getMeta(req));
    res.json({ success: true, data: result });
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
