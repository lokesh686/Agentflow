const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    secret: {
      type: String,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    callCount: { type: Number, default: 0 },
    lastTriggeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Webhook', webhookSchema);
