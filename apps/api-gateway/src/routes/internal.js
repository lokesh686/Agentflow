const express = require('express');
const router = express.Router();
const UsageRecord = require('../models/UsageRecord');
const { internalAuth } = require('../middleware/auth'); // A new middleware for internal services
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Middleware to protect internal routes
router.use(internalAuth);

router.post('/record-usage', async (req, res) => {
  const { teamId, tokensUsed } = req.body;
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const usageRecord = await UsageRecord.findOneAndUpdate(
      { teamId, period },
      { $inc: { executions: 1, tokens: tokensUsed } },
      { upsert: true, new: true }
    );

    // Send meter event to Stripe
    if (process.env.STRIPE_METER_ID) {
      await stripe.billing.meterEvents.create({
        event_name: 'tokens_used',
        payload: {
          value: tokensUsed,
          team_id: teamId,
        },
      });
    }

    res.status(200).json(usageRecord);
  } catch (error) {
    console.error('Failed to record usage:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

module.exports = router;
