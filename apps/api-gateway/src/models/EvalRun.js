const mongoose = require('mongoose');

const evalRunSchema = new mongoose.Schema({
  workflowId: { type: String, required: true, index: true },
  workflowVersion: { type: Number },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvalDataset', required: true },
  teamId: { type: String, required: true, index: true },
  score: { type: Number, default: 0 },
  cases: [{
    input: { type: mongoose.Schema.Types.Mixed },
    expected: { type: String },
    actual: { type: String },
    score: { type: Number, default: 0 },
    scorer: { type: String, enum: ['exact_match', 'regex', 'llm_judge', 'custom_python'] }
  }],
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

const EvalRun = mongoose.model('EvalRun', evalRunSchema);

module.exports = EvalRun;