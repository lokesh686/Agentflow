const express = require('express');
const router = express.Router();
const EvalDataset = require('../models/EvalDataset');
const EvalRun = require('../models/EvalRun');
const Workflow = require('../models/Workflow');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Get all datasets for a team
router.get('/datasets', requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    const datasets = await EvalDataset.find({ teamId: req.user.teamId }).sort({ createdAt: -1 });
    res.json({ success: true, data: datasets });
  } catch (err) {
    next(err);
  }
});

// Create a new dataset
router.post('/datasets', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { name, cases } = req.body;
    if (!name || !cases || !Array.isArray(cases)) {
      return res.status(400).json({ success: false, error: 'Name and cases array are required' });
    }
    
    const dataset = await EvalDataset.create({
      name,
      cases,
      teamId: req.user.teamId
    });
    
    res.status(201).json({ success: true, data: dataset });
  } catch (err) {
    next(err);
  }
});

// Get eval runs for a workflow
router.get('/runs/:workflowId', requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    
    const workflow = await Workflow.findOne({ _id: workflowId, teamId: req.user.teamId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const runs = await EvalRun.find({ workflowId, teamId: req.user.teamId })
      .populate('datasetId', 'name')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, data: runs });
  } catch (err) {
    next(err);
  }
});

// Start an eval run (queues it for the orchestrator)
router.post('/runs', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { workflowId, datasetId, scorer = 'llm_judge' } = req.body;
    
    const workflow = await Workflow.findOne({ _id: workflowId, teamId: req.user.teamId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const dataset = await EvalDataset.findOne({ _id: datasetId, teamId: req.user.teamId });
    if (!dataset) return res.status(404).json({ success: false, error: 'Dataset not found' });
    
    // Create the run record
    const run = await EvalRun.create({
      workflowId,
      workflowVersion: workflow.version,
      datasetId,
      teamId: req.user.teamId,
      status: 'running',
      cases: dataset.cases.map(c => ({
        input: c.input,
        expected: c.expected,
        scorer: scorer
      }))
    });
    
    // In a real app, we would push this to a specific "evals" BullMQ queue here.
    // For now, we will notify the orchestrator via HTTP API or just save it.
    // Let's assume the orchestrator sweeps for "running" EvalRuns or we push an HTTP call.
    try {
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://orchestrator:8001';
      fetch(`${orchestratorUrl.replace(/\/$/, '')}/api/evals/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalRunId: run._id.toString() })
      }).catch(err => console.error('Failed to trigger eval in orchestrator:', err.message));
    } catch (e) {
      console.warn('Orchestrator trigger failed', e);
    }
    
    res.status(201).json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

module.exports = router;