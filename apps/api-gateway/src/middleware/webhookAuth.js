const crypto = require('crypto');
const Workflow = require('../models/Workflow');

/**
 * Middleware to verify HMAC signature for webhook requests.
 * Expects header 'x-agentflow-signature' in format 'sha256=...'
 */
const verifyWebhookSignature = async (req, res, next) => {
  try {
    const { id, secret } = req.params;
    const workflow = await Workflow.findById(id);

    if (!workflow || workflow.status === 'archived' || workflow.deletedAt) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Use secret from URL or workflow-specific secret if implemented
    const webhookSecret = secret || workflow.webhookSecret;
    if (!webhookSecret) {
      return res.status(401).json({ success: false, error: 'Webhook secret not configured' });
    }

    const sig = req.headers['x-agentflow-signature'];
    if (!sig) {
      return res.status(401).json({ success: false, error: 'Missing signature header' });
    }

    const expected = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    } catch (e) {
      // Buffer length mismatch
      return res.status(401).json({ success: false, error: 'Invalid signature format' });
    }

    req.workflow = workflow;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyWebhookSignature };
