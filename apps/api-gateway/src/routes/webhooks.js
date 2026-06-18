const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const { addJob } = require('../queues/executionQueue');

router.post('/:workflowId/:secret', async (req, res) => {
  try {
    const { workflowId, secret } = req.params;
    const signature = req.headers['x-agentflow-signature'];

    const webhook = await Webhook.findOne({ workflowId, secret });
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }

    const hmac = crypto.createHmac('sha256', webhook.secret);
    const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

    if (signature !== digest) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const workflow = await Workflow.findById(workflowId);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const execution = new Execution({
      workflowId,
      teamId: webhook.teamId,
      input: req.body,
      triggeredBy: 'webhook',
      graph: workflow.graph,
      callbackUrl: req.body._callback_url,
    });
    await execution.save();

    await addJob({
      executionId: execution._id,
      workflowId,
      teamId: webhook.teamId,
      input: req.body,
      graph: workflow.graph,
    });

    webhook.lastTriggeredAt = new Date();
    webhook.callCount += 1;
    await webhook.save();

    res.json({ executionId: execution._id, status: 'QUEUED' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

