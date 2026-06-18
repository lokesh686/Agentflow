const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, required: true, index: true },
    tags: [{ type: String, lowercase: true, trim: true }],
    thumbnail: { type: String, default: null },
    workflowGraph: { type: Object, required: true },
    author: { type: String, default: 'AgentFlow Community' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usageCount: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    isPublic: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Indexes for searching
templateSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Template', templateSchema);
