const mongoose = require('mongoose');

// ─── Execution state machine ─────────────────────────────────────────────────
//  QUEUED → RUNNING → COMPLETED (terminal)
//                   → PAUSED → RUNNING | CANCELLED (terminal)
//                   → FAILED  → RETRYING → RUNNING | FAILED (terminal)
//  QUEUED → CANCELLED (terminal)

const VALID_STATUSES = ['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED', 'WAITING_FOR_APPROVAL'];

const ALLOWED_TRANSITIONS = {
  QUEUED:   ['RUNNING', 'CANCELLED'],
  RUNNING:  ['PAUSED', 'COMPLETED', 'FAILED', 'WAITING_FOR_APPROVAL'],
  PAUSED:   ['RUNNING', 'CANCELLED'],
  FAILED:   ['RETRYING'],
  RETRYING: ['RUNNING', 'FAILED'],
  WAITING_FOR_APPROVAL: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const toolCallSchema = new mongoose.Schema(
  {
    tool: { type: String, required: true },
    input: { type: Object },
    output: { type: Object },
    latencyMs: { type: Number },
    timestamp: { type: Date, default: Date.now },
    error: { type: String, default: null },
  },
  { _id: false }
);

const executionStepSchema = new mongoose.Schema(
  {
    agentName: { type: String, required: true },
    nodeId: { type: String },
    type: {
      type: String,
      enum: ['agent_start', 'agent_complete', 'agent_failed', 'tool_call', 'human_approval'],
      required: true,
    },
    input: { type: Object },
    output: { type: Object },
    tokensUsed: {
      prompt: { type: Number, default: 0 },
      completion: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    latencyMs: { type: Number },
    toolCalls: [toolCallSchema],
    attempt: { type: Number, default: 1 },
    error: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const executionSchema = new mongoose.Schema(
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
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workflowVersion: { type: Number },       // snapshot of version at trigger time
    input: { type: Object, required: true }, // user-provided task input

    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'QUEUED',
      index: true,
    },

    steps: [executionStepSchema],

    finalOutput: { type: String, default: null },

    callbackUrl: { type: String, default: null },

    totalTokens: {
      prompt:     { type: Number, default: 0 },
      completion: { type: Number, default: 0 },
      total:      { type: Number, default: 0 },
    },

    // Estimated cost in USD, calculated from token counts + model pricing
    estimatedCostUsd: { type: Number, default: 0 },

    durationMs: { type: Number, default: null },

    error: { type: String, default: null },

    // Human-in-the-loop state
    humanApproval: {
      required: { type: Boolean, default: false },
      agentName: { type: String, default: null },
      context: { type: String, default: null },
      options: [{ type: String }],
      requestedAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
      respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      decision: { type: String, enum: ['approved', 'rejected', null], default: null },
    },

    // Retry tracking
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },

    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound indexes for dashboard queries
executionSchema.index({ teamId: 1, status: 1, createdAt: -1 });
executionSchema.index({ workflowId: 1, createdAt: -1 });

/**
 * Attempt a status transition — validates against the state machine.
 */
executionSchema.methods.transition = function (newStatus) {
  const allowed = ALLOWED_TRANSITIONS[this.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Invalid status transition: ${this.status} → ${newStatus}`);
    err.status = 400;
    throw err;
  }
  this.status = newStatus;

  if (newStatus === 'RUNNING' && !this.startedAt) {
    this.startedAt = new Date();
  }
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(newStatus)) {
    this.completedAt = new Date();
    if (this.startedAt) {
      this.durationMs = this.completedAt - this.startedAt;
    }
  }
};

/**
 * Add a step log entry and accumulate token usage.
 */
executionSchema.methods.addStep = function (step) {
  this.steps.push(step);
  if (step.tokensUsed) {
    this.totalTokens.prompt     += step.tokensUsed.prompt     || 0;
    this.totalTokens.completion += step.tokensUsed.completion || 0;
    this.totalTokens.total      += step.tokensUsed.total      || 0;
  }
};

/**
 * Estimate cost in USD using rough per-model pricing.
 * Call after all steps are finalised.
 */
executionSchema.methods.calculateCost = function (model = 'gpt-4o') {
  const pricing = {
    'gpt-4o':           { input: 0.000005, output: 0.000015 },
    'gpt-4o-mini':      { input: 0.00000015, output: 0.0000006 },
    'gemini-1.5-pro':   { input: 0.000003, output: 0.000012 },
    'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
  };
  const p = pricing[model] || pricing['gpt-4o'];
  this.estimatedCostUsd =
    (this.totalTokens.prompt * p.input) +
    (this.totalTokens.completion * p.output);
  return this.estimatedCostUsd;
};

module.exports = mongoose.model('Execution', executionSchema);
module.exports.VALID_STATUSES = VALID_STATUSES;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
