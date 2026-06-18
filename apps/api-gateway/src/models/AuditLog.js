const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    action: { type: String, required: true },
    resource: { type: String, required: true }, // e.g. 'Workflow', 'User', 'Execution'
    resourceId: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

// Keep audit logs for 2 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

// Prevent updates and deletes (append-only)
auditLogSchema.pre('updateOne', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('updateMany', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('deleteOne', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('deleteMany', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('findOneAndDelete', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('findOneAndUpdate', function (next) { next(new Error('Audit logs are immutable')); });
auditLogSchema.pre('remove', function (next) { next(new Error('Audit logs are immutable')); });

module.exports = mongoose.model('AuditLog', auditLogSchema);
