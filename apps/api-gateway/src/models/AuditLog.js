const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    event: {
      type: String,
      required: true,
      enum: [
        'register',
        'login',
        'login_failed',
        'logout',
        'token_refresh',
        'password_reset_request',
        'password_reset_complete',
        'email_verified',
        'oauth_login',
        'team_invite_sent',
        'team_invite_accepted',
        'member_removed',
        'role_changed',
      ],
    },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Keep audit logs for 2 years (Enterprise) — TTL set per-record via meta, or managed by plan
auditLogSchema.index({ createdAt: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
