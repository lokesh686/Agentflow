const { verifyAccessToken } = require('../utils/jwt');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const bcrypt = require('bcrypt');

/**
 * Require a valid access token or API Key.
 * Attaches decoded payload as req.user: { sub, teamId, role, email }
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);

  if (token.startsWith('af_')) {
    try {
      const keyPrefix = token.substring(0, 11); // af_ + 8 chars
      const apiKey = await ApiKey.findOne({ keyPrefix });
      if (!apiKey) return res.status(401).json({ success: false, error: 'Invalid API key' });

      const isValid = await apiKey.compareKey(token);
      if (!isValid) return res.status(401).json({ success: false, error: 'Invalid API key' });

      const user = await User.findById(apiKey.userId);
      if (!user) return res.status(401).json({ success: false, error: 'User not found' });

      req.user = { sub: user._id.toString(), teamId: user.teamId.toString(), role: user.role, email: user.email };
      
      apiKey.lastUsedAt = new Date();
      await apiKey.save();
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Access token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid access token' });
  }
}

/**
 * Require a minimum role level.
 * Role hierarchy: owner > admin > member > viewer
 */
const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] ?? -1;
    const minRank = ROLE_RANK[minRole] ?? 0;
    if (userRank < minRank) {
      return res.status(403).json({ success: false, error: `Requires ${minRole} role or higher` });
    }
    next();
  };
}

const internalAuth = (req, res, next) => {
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_API_TOKEN) {
    return res.status(401).json({ success: false, error: 'Invalid or missing internal token' });
  }
  next();
};

module.exports = { requireAuth, requireRole, internalAuth };
