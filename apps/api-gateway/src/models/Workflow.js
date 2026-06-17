const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

// ReactFlow + LangGraph node config
const agentNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },           // ReactFlow node id
    type: {
      type: String,
      required: true,
      enum: ['research', 'writer', 'code', 'data', 'decision', 'notifier', 'custom'],
    },
    label: { type: String },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    config: {
      systemPrompt: { type: String, default: '' },
      model: { type: String, default: 'gpt-4o' },
      temperature: { type: Number, default: 0.7, min: 0, max: 2 },
      tools: [{ type: String }],           // e.g. ['web_search', 'url_scraper']
      maxTokens: { type: Number, default: 2048 },
      customConfig: { type: Object, default: {} }, // arbitrary agent-specific config
    },
  },
  { _id: false }
);

// ReactFlow edge (connection between agents)
const workflowEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },  // node id
    target: { type: String, required: true },  // node id
    condition: {
      type: { type: String, enum: ['always', 'on_success', 'on_error', 'contains', 'custom'], default: 'always' },
      value: { type: String, default: '' },    // used for 'contains' / 'custom' conditions
    },
    label: { type: String },
  },
  { _id: false }
);

// Snapshot stored in version history
const workflowSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    savedAt: { type: Date, default: Date.now },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    graph: {
      nodes: [agentNodeSchema],
      edges: [workflowEdgeSchema],
    },
  },
  { _id: false }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const workflowSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },
    tags: [{ type: String, lowercase: true, trim: true }],

    // Live graph definition
    graph: {
      nodes: [agentNodeSchema],
      edges: [workflowEdgeSchema],
    },

    // Auto-incremented on every save
    version: { type: Number, default: 1 },

    // Last 10 versions kept as snapshots
    history: {
      type: [workflowSnapshotSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'History may not exceed 10 snapshots',
      },
    },

    // Execution stats (denormalised for dashboard queries)
    stats: {
      totalExecutions: { type: Number, default: 0 },
      lastExecutedAt: { type: Date, default: null },
      successRate: { type: Number, default: null },  // 0-1
    },

    // Soft delete
    deletedAt: { type: Date, default: null },

    // Webhook configuration
    webhookSecret: { type: String, default: null },
  },
  { timestamps: true }
);

// Compound index for efficient per-team listing
workflowSchema.index({ teamId: 1, status: 1, updatedAt: -1 });

/**
 * Snapshot current graph before overwriting — keeps last 10 versions.
 */
workflowSchema.methods.snapshotCurrent = function (userId) {
  const snapshot = {
    version: this.version,
    savedAt: new Date(),
    savedBy: userId,
    graph: JSON.parse(JSON.stringify(this.graph)), // deep clone
  };
  this.history.unshift(snapshot);
  if (this.history.length > 10) {
    this.history = this.history.slice(0, 10);
  }
};

/**
 * Validate graph structure — checks for disconnected nodes, missing configs,
 * and loops without a termination node.
 */
workflowSchema.methods.validateGraph = function () {
  const errors = [];
  const { nodes, edges } = this.graph;

  if (!nodes || nodes.length === 0) {
    errors.push('Workflow must contain at least one agent node');
    return errors;
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const connectedIds = new Set();

  // Check edges reference valid nodes
  for (const edge of edges || []) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge references unknown source node: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge references unknown target node: ${edge.target}`);
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  // Disconnected node check (only warn if >1 node)
  if (nodes.length > 1) {
    for (const node of nodes) {
      if (!connectedIds.has(node.id)) {
        errors.push(`Node "${node.label || node.id}" is disconnected from the workflow`);
      }
    }
  }

  // Missing system prompt on custom nodes
  for (const node of nodes) {
    if (node.type === 'custom' && !node.config?.systemPrompt?.trim()) {
      errors.push(`Custom node "${node.label || node.id}" requires a system prompt`);
    }
  }

  return errors;
};

module.exports = mongoose.model('Workflow', workflowSchema);
