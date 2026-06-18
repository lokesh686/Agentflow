const mongoose = require('mongoose');

const evalDatasetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teamId: { type: String, required: true, index: true },
  cases: [{
    input: { type: mongoose.Schema.Types.Mixed, required: true },
    expected: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

const EvalDataset = mongoose.model('EvalDataset', evalDatasetSchema);

module.exports = EvalDataset;