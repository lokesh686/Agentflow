const express = require('express');
const router = express.Router();
const PromptVersion = require('../models/PromptVersion');
const { requireAuth } = require('../middleware/auth');
const Workflow = require('../models/Workflow'); // Need to ensure the user has access to the workflow

// Get all prompt versions for a specific node in a workflow
router.get('/:workflowId/:nodeId', requireAuth, async (req, res, next) => {
  try {
    const { workflowId, nodeId } = req.params;

    // Check workflow access
    const workflow = await Workflow.findOne({ _id: workflowId, userId: req.user._id });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found or access denied' });
    }

    const versions = await PromptVersion.find({ workflowId, nodeId })
      .sort({ version: -1 })
      .lean();

    res.json({ success: true, data: versions });
  } catch (err) {
    next(err);
  }
});

// Create a new prompt version
router.post('/:workflowId/:nodeId', requireAuth, async (req, res, next) => {
  try {
    const { workflowId, nodeId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    // Check workflow access
    const workflow = await Workflow.findOne({ _id: workflowId, userId: req.user._id });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found or access denied' });
    }

    // Get latest version number
    const latest = await PromptVersion.findOne({ workflowId, nodeId })
      .sort({ version: -1 });

    const nextVersion = latest ? latest.version + 1 : 1;

    const newVersion = await PromptVersion.create({
      workflowId,
      nodeId,
      version: nextVersion,
      content,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: newVersion });
  } catch (err) {
    next(err);
  }
});

// Diff two versions (can be done on frontend, but good to have)
router.get('/:workflowId/:nodeId/diff', requireAuth, async (req, res, next) => {
  try {
    const { workflowId, nodeId } = req.params;
    const { v1, v2 } = req.query; // version numbers

    if (!v1 || !v2) {
      return res.status(400).json({ success: false, error: 'v1 and v2 query params are required' });
    }

    const versions = await PromptVersion.find({
      workflowId,
      nodeId,
      version: { $in: [Number(v1), Number(v2)] }
    });

    if (versions.length !== 2) {
      return res.status(404).json({ success: false, error: 'One or both versions not found' });
    }

    // Could use a lib like 'diff' here, but sending text to frontend is fine
    res.json({ success: true, data: versions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
