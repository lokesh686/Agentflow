const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    period: {
      type: String, // YYYY-MM
      required: true,
      index: true,
    },
    executions: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageRecordSchema.index({ teamId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
