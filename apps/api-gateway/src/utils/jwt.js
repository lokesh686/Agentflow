const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_SECRET_PRIVATE || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Issue a short-lived access token (15 min)
 * Payload: userId, teamId, role, email
 */
function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      teamId: user.teamId?.toString(),
      role: user.role,
      email: user.email,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY, issuer: 'agentflow-pro' }
  );
}

/**
 * Issue a long-lived refresh token (7 days)
 * Returns { token, hash } — store only the hash in DB
 */
function issueRefreshToken(userId) {
  const token = jwt.sign(
    { sub: userId.toString(), type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY, issuer: 'agentflow-pro' }
  );
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Verify an access token; throws on invalid/expired
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'agentflow-pro' });
}

/**
 * Verify a refresh token; throws on invalid/expired
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, { issuer: 'agentflow-pro' });
}

/**
 * Hash a refresh token for storage/lookup
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a short time-limited token (email verification, password reset)
 * Uses jwt with a 1h expiry by default; returns the signed token string.
 */
function issueEmailToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn, issuer: 'agentflow-pro' });
}

function verifyEmailToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'agentflow-pro' });
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  issueEmailToken,
  verifyEmailToken,
};
