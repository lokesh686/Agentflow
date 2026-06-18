const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const billing = require('../services/billingService');
const User = require('../models/User');

const router = express.Router();

// GET /v1/billing — current plan + invoice history
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const status = await billing.getBillingStatus(req.user.teamId);
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
});

// POST /v1/billing/checkout — create Stripe Checkout session
router.post('/checkout', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    const user = await User.findById(req.user.sub);
    const result = await billing.createCheckoutSession({
      teamId: req.user.teamId,
      plan,
      ownerEmail: user.email,
      ownerName: user.name,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /v1/billing/portal — Stripe customer portal (manage/cancel)
router.post('/portal', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await billing.createPortalSession(req.user.teamId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /v1/billing/webhook — Stripe webhook (raw body required)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const sig = req.headers['stripe-signature'];
      const result = await billing.handleWebhook(req.body, sig);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

const UsageRecord = require('../models/UsageRecord');

router.get('/usage', protect, async (req, res) => {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    const usage = await UsageRecord.findOne({ teamId: req.user.teamId, period });
    res.json({
      executions: usage ? usage.executions : 0,
      tokens: usage ? usage.tokens : 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch usage data' });
  }
});

module.exports = router;
