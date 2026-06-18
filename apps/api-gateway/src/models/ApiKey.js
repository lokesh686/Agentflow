const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    scopes: [{ type: String, enum: ['workflows:read', 'workflows:write', 'executions:read', 'executions:write'] }],
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.methods.compareKey = async function (plainKey) {
  return bcrypt.compare(plainKey, this.keyHash);
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
