const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Template = require('../models/Template');
const Workflow = require('../models/Workflow');
const Joi = require('joi');

const router = express.Router();

// GET /v1/templates - List templates
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { category, search, featured, limit = 50 } = req.query;
    
    const query = { isPublic: true };
    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (search) query.$text = { $search: search };

    const templates = await Template.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { usageCount: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// GET /v1/templates/:id - Get single template
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template || (!template.isPublic && String(template.authorId) !== req.user.sub)) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// POST /v1/templates/:id/clone - Clone to user's workflows
router.post('/:id/clone', requireAuth, async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // Increment usage count
    template.usageCount += 1;
    await template.save();

    // Create a new workflow for the user based on the template
    const workflow = await Workflow.create({
      name: `${template.name} (Clone)`,
      description: template.description,
      teamId: req.user.teamId,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
      tags: template.tags,
      graph: template.workflowGraph,
      status: 'draft',
      version: 1
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (err) {
    next(err);
  }
});

// POST /v1/templates - Submit a template from an existing workflow
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = Joi.object({
      workflowId: Joi.string().required(),
      name: Joi.string().required().max(200),
      description: Joi.string().max(2000).allow(''),
      category: Joi.string().required(),
      tags: Joi.array().items(Joi.string()),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const workflow = await Workflow.findOne({ _id: value.workflowId, teamId: req.user.teamId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const template = await Template.create({
      name: value.name,
      description: value.description,
      category: value.category,
      tags: value.tags || [],
      workflowGraph: workflow.graph,
      authorId: req.user.sub,
      isPublic: true,
      isFeatured: false,
    });

    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
