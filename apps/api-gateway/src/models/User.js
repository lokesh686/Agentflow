const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      default: null, // null for OAuth-only users
    },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: null },
    oauthProvider: {
      type: String,
      enum: ['google', 'github', null],
      default: null,
    },
    oauthId: { type: String, default: null },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member',
    },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationExpiry: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpiry: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  // Only hash if it looks like a plain-text password (not already a bcrypt hash)
  if (!this.passwordHash.startsWith('$2b$')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  }
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

// Sanitize output — never expose sensitive fields
userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.verificationToken;
  delete obj.verificationExpiry;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpiry;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
