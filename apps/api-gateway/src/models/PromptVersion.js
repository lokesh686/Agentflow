const mongoose = require('mongoose');

const promptVersionSchema = new mongoose.Schema({
  workflowId: {
    type: String,
    required: true,
    index: true
  },
  nodeId: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  metrics: {
    executions: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Ensure unique versions per node per workflow
promptVersionSchema.index({ workflowId: 1, nodeId: 1, version: 1 }, { unique: true });

const PromptVersion = mongoose.model('PromptVersion', promptVersionSchema);

module.exports = PromptVersion;
