const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// POST /v1/executions/internal/dlq-alert
router.post('/internal/dlq-alert', async (req, res, next) => {
  try {
    const token = process.env.INTERNAL_API_TOKEN;
    if (token && req.headers['x-internal-token'] !== token) {
      return res.status(401).json({ success: false, error: 'Unauthorized internal alert' });
    }

    const { executionId, reason, attempts } = req.body || {};
    if (!executionId || !reason) {
      return res.status(400).json({ success: false, error: 'executionId and reason are required' });
    }

    const Execution = require('../models/Execution');
    const execution = await Execution.findById(executionId);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    if (execution.status === 'QUEUED' || execution.status === 'RUNNING') {
      execution.status = 'FAILED';
      execution.error = `Moved to dead-letter queue after ${attempts || 3} attempts: ${reason}`;
      execution.completedAt = new Date();
      await execution.save();
    }

    res.status(202).json({ success: true });
  } catch (err) { next(err); }
});

// GET /v1/executions — list team executions
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const Execution = require('../models/Execution');
    const { workflowId, status, cursor, limit } = req.query;
    const query = { teamId: req.user.teamId };
    if (workflowId) query.workflowId = workflowId;
    if (status) query.status = status;
    if (cursor) query._id = { $lt: cursor };
    const executions = await Execution.find(query).sort({ _id: -1 })
      .limit(Math.min(parseInt(limit) || 20, 100)).select('-steps').lean();
    res.json({ success: true, data: executions });
  } catch (err) { next(err); }
});

// GET /v1/executions/:id — get full execution with steps
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const Execution = require('../models/Execution');
    const execution = await Execution.findOne({ _id: req.params.id, teamId: req.user.teamId });
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });
    res.json({ success: true, data: execution });
  } catch (err) { next(err); }
});

// POST /v1/executions/:id/cancel
router.post('/:id/cancel', requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    const Execution = require('../models/Execution');
    const execution = await Execution.findOne({ _id: req.params.id, teamId: req.user.teamId });
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });
    if (!['QUEUED', 'RUNNING', 'PAUSED'].includes(execution.status)) {
      return res.status(400).json({ success: false, error: `Cannot cancel ${execution.status} execution` });
    }
    execution.transition('CANCELLED');
    await execution.save();
    const io = req.app.get('io');
    if (io) io.to(`execution:${req.params.id}`).emit('execution:status', { executionId: req.params.id, status: 'CANCELLED' });
    res.json({ success: true, data: { status: 'CANCELLED' } });
  } catch (err) { next(err); }
});

// POST /v1/executions/:id/approve — human-in-the-loop decision
router.post('/:id/approve', requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    const Execution = require('../models/Execution');
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision must be "approved" or "rejected"' });
    }
    const execution = await Execution.findOne({ _id: req.params.id, teamId: req.user.teamId });
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });
    if (execution.status !== 'PAUSED' || !execution.humanApproval?.required) {
      return res.status(400).json({ success: false, error: 'Execution is not awaiting approval' });
    }
    execution.humanApproval.decision = decision;
    execution.humanApproval.respondedAt = new Date();
    execution.humanApproval.respondedBy = req.user.sub;
    execution.transition(decision === 'approved' ? 'RUNNING' : 'CANCELLED');
    await execution.save();
    const io = req.app.get('io');
    if (io) io.to(`execution:${req.params.id}`).emit('execution:approval_decision', { executionId: req.params.id, decision, status: execution.status });
    res.json({ success: true, data: { decision, status: execution.status } });
  } catch (err) { next(err); }
});

module.exports = router;
