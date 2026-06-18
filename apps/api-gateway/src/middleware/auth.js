const { verifyAccessToken } = require('../utils/jwt');

/**
 * Require a valid access token.
 * Attaches decoded payload as req.user: { sub, teamId, role, email }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
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

module.exports = { requireAuth, requireRole };
