const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
      default: 'active',
    },
    usageCurrentPeriod: {
      executions: { type: Number, default: 0 },
      periodStart: { type: Date, default: Date.now },
    },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    invites: [
      {
        email: { type: String, lowercase: true },
        role: { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
        token: String,
        expiresAt: Date,
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

// Plan limits helper
teamSchema.methods.getPlanLimits = function () {
  const limits = {
    free: { workflows: 2, executionsPerMonth: 50, members: 1 },
    pro: { workflows: 20, executionsPerMonth: 2000, members: 5 },
    enterprise: { workflows: Infinity, executionsPerMonth: Infinity, members: Infinity },
  };
  return limits[this.plan] || limits.free;
};

module.exports = mongoose.model('Team', teamSchema);
