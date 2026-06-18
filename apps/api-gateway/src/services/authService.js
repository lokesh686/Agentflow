const crypto = require('crypto');
const User = require('../models/User');
const Team = require('../models/Team');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  hashToken,
  issueEmailToken,
  verifyEmailToken,
} = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

/**
 * Register a new user + create their team
 */
async function register({ name, email, password }, meta = {}) {
  // Check for existing user
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  // Create team first
  const teamSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  const team = await Team.create({ name: `${name}'s Team`, slug: teamSlug, ownerId: null });

  // Create user — passwordHash will be bcrypt-hashed by the pre-save hook
  const verificationToken = issueEmailToken({ type: 'email-verification', email }, '24h');
  const user = await User.create({
    name,
    email,
    passwordHash: password,  // pre-save hook hashes this
    teamId: team._id,
    role: 'owner',
    verified: false,
    verificationToken,
    verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Patch team ownerId now that user exists
  team.ownerId = user._id;
  team.members.push({ userId: user._id, role: 'owner' });
  await team.save();

  // Send verification email (fire-and-forget; don't fail registration if email fails)
  sendVerificationEmail(email, name, verificationToken).catch(console.error);

  await AuditLog.create({ userId: user._id, teamId: team._id, event: 'register', ...meta });

  return { user: user.toPublic(), team };
}

/**
 * Login with email + password — returns access + refresh tokens
 */
async function login({ email, password }, meta = {}) {
  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    if (user) {
      await AuditLog.create({ userId: user._id, event: 'login_failed', ...meta });
    }
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  if (!user.verified) {
    const err = new Error('Please verify your email before logging in');
    err.status = 403;
    throw err;
  }

  const { accessToken, refreshToken } = await _issueTokenPair(user, meta);
  user.lastLoginAt = new Date();
  await user.save();
  await AuditLog.create({ userId: user._id, teamId: user.teamId, event: 'login', ...meta });

  return { user: user.toPublic(), accessToken, refreshToken };
}

/**
 * Rotate refresh token — invalidate old, issue new pair
 */
async function refreshTokens(oldRefreshToken, meta = {}) {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const hash = hashToken(oldRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash: hash });
  if (!stored) {
    const err = new Error('Refresh token not found or already used');
    err.status = 401;
    throw err;
  }

  // Rotate: delete old token
  await RefreshToken.deleteOne({ tokenHash: hash });

  const user = await User.findById(payload.sub);
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }

  const { accessToken, refreshToken } = await _issueTokenPair(user, meta);
  await AuditLog.create({ userId: user._id, teamId: user.teamId, event: 'token_refresh', ...meta });

  return { accessToken, refreshToken };
}

/**
 * Verify email address using token from email link
 */
async function verifyEmail(token) {
  let payload;
  try {
    payload = verifyEmailToken(token);
  } catch {
    const err = new Error('Invalid or expired verification link');
    err.status = 400;
    throw err;
  }

  if (payload.type !== 'email-verification') {
    const err = new Error('Invalid token type');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({ email: payload.email, verificationToken: token });
  if (!user) {
    const err = new Error('Verification token not found or already used');
    err.status = 400;
    throw err;
  }

  user.verified = true;
  user.verificationToken = null;
  user.verificationExpiry = null;
  await user.save();
  await AuditLog.create({ userId: user._id, teamId: user.teamId, event: 'email_verified' });

  return { message: 'Email verified successfully' };
}

/**
 * Request a password reset email
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  // Always return success to prevent user enumeration
  if (!user) return { message: 'If that email exists, a reset link has been sent' };

  const resetToken = issueEmailToken({ type: 'password-reset', userId: user._id.toString() }, '1h');
  user.passwordResetToken = resetToken;
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  sendPasswordResetEmail(email, user.name, resetToken).catch(console.error);
  await AuditLog.create({ userId: user._id, event: 'password_reset_request' });

  return { message: 'If that email exists, a reset link has been sent' };
}

/**
 * Complete a password reset
 */
async function resetPassword(token, newPassword) {
  let payload;
  try {
    payload = verifyEmailToken(token);
  } catch {
    const err = new Error('Invalid or expired reset link');
    err.status = 400;
    throw err;
  }

  if (payload.type !== 'password-reset') {
    const err = new Error('Invalid token type');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({ _id: payload.userId, passwordResetToken: token });
  if (!user) {
    const err = new Error('Reset token not found or already used');
    err.status = 400;
    throw err;
  }

  user.passwordHash = newPassword; // pre-save hook will hash it
  user.passwordResetToken = null;
  user.passwordResetExpiry = null;
  await user.save();

  // Invalidate all existing refresh tokens
  await RefreshToken.deleteMany({ userId: user._id });
  await AuditLog.create({ userId: user._id, event: 'password_reset_complete' });

  return { message: 'Password reset successful' };
}

/**
 * Logout — revoke the given refresh token
 */
async function logout(refreshToken, userId) {
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    await RefreshToken.deleteOne({ tokenHash: hash });
  }
  if (userId) {
    await AuditLog.create({ userId, event: 'logout' });
  }
  return { message: 'Logged out' };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function _issueTokenPair(user, meta) {
  const accessToken = issueAccessToken(user);
  const { token: refreshToken, hash } = issueRefreshToken(user._id);

  // Store hashed refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    tokenHash: hash,
    userId: user._id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

module.exports = {
  register,
  login,
  refreshTokens,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  logout,
};
