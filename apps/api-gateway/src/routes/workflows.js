const express = require('express');
const Joi = require('joi');
const workflowService = require('../services/workflowService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkPlanLimits } = require('../middleware/planLimits');
const { verifyWebhookSignature } = require('../middleware/webhookAuth');

const router = express.Router();

const nodeConfigSchema = Joi.object({
  systemPrompt: Joi.string().allow('').max(8000),
  model: Joi.string().max(100),
  temperature: Joi.number().min(0).max(2),
  tools: Joi.array().items(Joi.string()),
  maxTokens: Joi.number().integer().min(1).max(32000),
  customConfig: Joi.object(),
});

const nodeSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('research','writer','code','data','decision','notifier','custom').required(),
  label: Joi.string().max(100),
  position: Joi.object({ x: Joi.number(), y: Joi.number() }),
  config: nodeConfigSchema,
});

const edgeSchema = Joi.object({
  id: Joi.string().required(),
  source: Joi.string().required(),
  target: Joi.string().required(),
  condition: Joi.object({
    type: Joi.string().valid('always','on_success','on_error','contains','custom'),
    value: Joi.string().allow(''),
  }),
  label: Joi.string().max(100),
});

const graphSchema = Joi.object({
  nodes: Joi.array().items(nodeSchema).max(20),
  edges: Joi.array().items(edgeSchema),
});

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().allow('').max(2000),
  tags: Joi.array().items(Joi.string().lowercase().max(50)).max(10),
  graph: graphSchema,
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  description: Joi.string().allow('').max(2000),
  tags: Joi.array().items(Joi.string().lowercase().max(50)).max(10),
  graph: graphSchema,
  status: Joi.string().valid('draft','active','archived'),
}).min(1);

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });
    req.body = value;
    next();
  };
}

// POST /v1/workflows — create
router.post('/', requireAuth, requireRole('member'), validate(createSchema), async (req, res, next) => {
  try {
    const workflow = await workflowService.createWorkflow({
      teamId: req.user.teamId, userId: req.user.sub, ...req.body,
    });
    res.status(201).json({ success: true, data: workflow });
  } catch (err) { next(err); }
});

// GET /v1/workflows — list
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, tag, search, cursor, limit } = req.query;
    const result = await workflowService.listWorkflows({
      teamId: req.user.teamId, status, tag, search, cursor,
      limit: Math.min(parseInt(limit) || 20, 100),
    });
    res.json({ success: true, data: result.items, meta: { hasMore: result.hasMore, cursor: result.cursor } });
  } catch (err) { next(err); }
});

// GET /v1/workflows/:id — get single
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflow({ workflowId: req.params.id, teamId: req.user.teamId });
    res.json({ success: true, data: workflow });
  } catch (err) { next(err); }
});

// PUT /v1/workflows/:id — update
router.put('/:id', requireAuth, requireRole('member'), validate(updateSchema), async (req, res, next) => {
  try {
    const workflow = await workflowService.updateWorkflow({
      workflowId: req.params.id, teamId: req.user.teamId, userId: req.user.sub, updates: req.body,
    });
    res.json({ success: true, data: workflow });
  } catch (err) { next(err); }
});

// DELETE /v1/workflows/:id — soft delete (admin+)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await workflowService.deleteWorkflow({ workflowId: req.params.id, teamId: req.user.teamId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /v1/workflows/:id/versions/:version — historical snapshot
router.get('/:id/versions/:version', requireAuth, async (req, res, next) => {
  try {
    const snapshot = await workflowService.getWorkflowVersion({
      workflowId: req.params.id, teamId: req.user.teamId, version: parseInt(req.params.version),
    });
    res.json({ success: true, data: snapshot });
  } catch (err) { next(err); }
});

// POST /v1/workflows/:id/execute — queue execution
router.post('/:id/execute', requireAuth, requireRole('member'), checkPlanLimits, async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflow({ workflowId: req.params.id, teamId: req.user.teamId });
    if (workflow.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Cannot execute an archived workflow' });
    }
    const errors = workflow.validateGraph();
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Workflow graph is invalid', details: errors });
    }
    const Execution = require('../models/Execution');
    const { addJob } = require('../queues/executionQueue');
    const execution = await Execution.create({
      workflowId: workflow._id, teamId: req.user.teamId, triggeredBy: req.user.sub,
      workflowVersion: workflow.version, input: req.body.input || {}, status: 'QUEUED',
    });
    try {
      await addJob({
        executionId: execution._id.toString(), workflowId: workflow._id.toString(),
        teamId: req.user.teamId, graph: workflow.graph, input: execution.input,
      });
    } catch (redisErr) {
      execution.status = 'FAILED';
      execution.error = 'Failed to queue: ' + redisErr.message;
      await execution.save();
      return res.status(503).json({ success: false, error: 'Execution queue unavailable' });
    }
    res.status(202).json({ success: true, data: { executionId: execution._id, status: 'QUEUED' } });
  } catch (err) { next(err); }
});

// POST /v1/workflows/webhooks/:id/:secret — public webhook trigger
router.post('/webhooks/:id/:secret', verifyWebhookSignature, async (req, res, next) => {
  try {
    const workflow = req.workflow;
    const errors = workflow.validateGraph();
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Workflow graph is invalid', details: errors });
    }

    const Execution = require('../models/Execution');
    const { getRedis } = require('../config/redis');

    const execution = await Execution.create({
      workflowId: workflow._id,
      teamId: workflow.teamId,
      triggeredBy: workflow.createdBy, // Fallback to workflow creator
      workflowVersion: workflow.version,
      input: req.body,
      callbackUrl: req.body._callback_url || null,
      status: 'QUEUED',
    });

    try {
      const redis = getRedis();
      await redis.lPush('execution:queue', JSON.stringify({
        executionId: execution._id.toString(),
        workflowId: workflow._id.toString(),
        teamId: workflow.teamId.toString(),
        graph: workflow.graph,
        input: execution.input,
      }));
    } catch (redisErr) {
      execution.status = 'FAILED';
      execution.error = 'Failed to queue: ' + redisErr.message;
      await execution.save();
      return res.status(503).json({ success: false, error: 'Execution queue unavailable' });
    }

    res.status(202).json({
      success: true,
      data: { executionId: execution._id, status: 'QUEUED' }
    });
  } catch (err) {
    next(err);
  }
});

const crypto = require('crypto');
const Webhook = require('../models/Webhook');

router.get('/:id/webhook', protect, async (req, res) => {
  try {
    let webhook = await Webhook.findOne({ workflowId: req.params.id, teamId: req.user.teamId });
    if (!webhook) {
      webhook = new Webhook({ workflowId: req.params.id, teamId: req.user.teamId });
      await webhook.save();
    }
    res.json(webhook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/webhook/rotate', protect, async (req, res) => {
  try {
    const webhook = await Webhook.findOne({ workflowId: req.params.id, teamId: req.user.teamId });
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    webhook.secret = crypto.randomBytes(32).toString('hex');
    await webhook.save();
    res.json(webhook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
