const crypto = require('crypto');
const User = require('../models/User');
const Team = require('../models/Team');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const { issueAccessToken, issueRefreshToken } = require('../utils/jwt');

/**
 * Upsert a user from OAuth provider data, issue token pair.
 *
 * @param {object} profile  Normalised provider profile
 *   { provider: 'google'|'github', id, email, name, avatar }
 * @param {object} meta     { ip, userAgent }
 */
async function oauthLogin(profile, meta = {}) {
  const { provider, id: oauthId, email, name, avatar } = profile;

  if (!email) {
    const err = new Error('OAuth provider did not return an email address');
    err.status = 400;
    throw err;
  }

  // Try to find by OAuth provider + id first, then fall back to email
  let user = await User.findOne({ oauthProvider: provider, oauthId });

  if (!user) {
    // Check if account already exists with this email (merge)
    user = await User.findOne({ email });
  }

  if (user) {
    // Link OAuth if not already linked
    if (!user.oauthProvider) {
      user.oauthProvider = provider;
      user.oauthId = oauthId;
    }
    if (avatar && !user.avatar) user.avatar = avatar;
    user.verified = true; // OAuth-verified emails are considered verified
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    // New user — create with a team
    const teamSlug =
      (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') +
      '-' +
      crypto.randomBytes(3).toString('hex');

    const team = await Team.create({
      name: `${name}'s Team`,
      slug: teamSlug,
      ownerId: null,
    });

    user = await User.create({
      name,
      email,
      avatar,
      oauthProvider: provider,
      oauthId,
      teamId: team._id,
      role: 'owner',
      verified: true,
      lastLoginAt: new Date(),
    });

    team.ownerId = user._id;
    team.members.push({ userId: user._id, role: 'owner' });
    await team.save();
  }

  // Issue tokens
  const accessToken = issueAccessToken(user);
  const { token: refreshToken, hash } = issueRefreshToken(user._id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    tokenHash: hash,
    userId: user._id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    expiresAt,
  });

  await AuditLog.create({
    userId: user._id,
    teamId: user.teamId,
    event: 'oauth_login',
    ip: meta.ip,
    userAgent: meta.userAgent,
    meta: { provider },
  });

  return { user: user.toPublic(), accessToken, refreshToken };
}

/**
 * Exchange a Google ID token (from frontend) for user profile data.
 * Validates the token using Google's tokeninfo endpoint.
 */
async function verifyGoogleToken(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!res.ok) {
    const err = new Error('Invalid Google ID token');
    err.status = 401;
    throw err;
  }
  const data = await res.json();
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) {
    const err = new Error('Google token audience mismatch');
    err.status = 401;
    throw err;
  }
  return {
    provider: 'google',
    id: data.sub,
    email: data.email,
    name: data.name,
    avatar: data.picture,
  };
}

/**
 * Exchange a GitHub OAuth code for user profile data.
 * Used in server-side OAuth code exchange flow.
 */
async function verifyGithubCode(code) {
  // Step 1: Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    const err = new Error('GitHub OAuth code exchange failed');
    err.status = 401;
    throw err;
  }

  // Step 2: Fetch user profile
  const profileRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  const profile = await profileRes.json();

  // Step 3: Fetch primary verified email (GitHub may not return email in profile)
  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const emails = await emailsRes.json();
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email || null;
  }

  return {
    provider: 'github',
    id: String(profile.id),
    email,
    name: profile.name || profile.login,
    avatar: profile.avatar_url,
  };
}

module.exports = { oauthLogin, verifyGoogleToken, verifyGithubCode };
