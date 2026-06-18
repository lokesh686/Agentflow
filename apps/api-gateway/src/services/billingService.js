const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');

const PLANS = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
    name: 'Pro',
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
    name: 'Enterprise',
  },
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Create or retrieve a Stripe customer for the team.
 */
async function getOrCreateCustomer(team, ownerEmail, ownerName) {
  if (team.stripeCustomerId) {
    return team.stripeCustomerId;
  }
  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: ownerName,
    metadata: { teamId: team._id.toString() },
  });
  team.stripeCustomerId = customer.id;
  await team.save();
  return customer.id;
}

/**
 * Create a Stripe Checkout session for upgrading to pro/enterprise.
 */
async function createCheckoutSession({ teamId, plan, ownerEmail, ownerName }) {
  const team = await Team.findById(teamId);
  if (!team) { const e = new Error('Team not found'); e.status = 404; throw e; }

  const planConfig = PLANS[plan];
  if (!planConfig) { const e = new Error('Invalid plan'); e.status = 400; throw e; }

  const customerId = await getOrCreateCustomer(team, ownerEmail, ownerName);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/billing?canceled=true`,
    metadata: { teamId: teamId.toString(), plan },
    subscription_data: {
      metadata: { teamId: teamId.toString(), plan },
    },
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session for managing subscription.
 */
async function createPortalSession(teamId) {
  const team = await Team.findById(teamId);
  if (!team?.stripeCustomerId) {
    const e = new Error('No billing account found'); e.status = 400; throw e;
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${FRONTEND_URL}/billing`,
  });
  return { url: session.url };
}

/**
 * Handle Stripe webhook events — update team plan/status in DB.
 */
async function handleWebhook(rawBody, signature) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const e = new Error(`Webhook signature verification failed: ${err.message}`);
    e.status = 400;
    throw e;
  }

  const data = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      if (data.mode === 'subscription') {
        const { teamId, plan } = data.metadata;
        await Team.findByIdAndUpdate(teamId, {
          plan,
          stripeSubscriptionId: data.subscription,
          subscriptionStatus: 'active',
        });
        await AuditLog.create({ teamId, event: 'plan_upgraded', meta: { plan } });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const teamId = data.metadata?.teamId;
      if (!teamId) break;
      const plan = data.metadata?.plan ?? 'pro';
      await Team.findByIdAndUpdate(teamId, {
        plan: data.cancel_at_period_end ? 'free' : plan,
        subscriptionStatus: data.status,
        stripeSubscriptionId: data.id,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const teamId = data.metadata?.teamId;
      if (!teamId) break;
      await Team.findByIdAndUpdate(teamId, {
        plan: 'free',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
      });
      await AuditLog.create({ teamId, event: 'plan_downgraded', meta: { reason: 'subscription_deleted' } });
      break;
    }

    case 'invoice.payment_failed': {
      const sub = await stripe.subscriptions.retrieve(data.subscription);
      const teamId = sub.metadata?.teamId;
      if (teamId) {
        await Team.findByIdAndUpdate(teamId, { subscriptionStatus: 'past_due' });
      }
      break;
    }
  }

  return { received: true };
}

/**
 * Get current billing status for a team.
 */
async function getBillingStatus(teamId) {
  const team = await Team.findById(teamId).select('plan subscriptionStatus stripeSubscriptionId stripeCustomerId');
  if (!team) { const e = new Error('Team not found'); e.status = 404; throw e; }

  let invoices = [];
  if (team.stripeCustomerId) {
    try {
      const inv = await stripe.invoices.list({ customer: team.stripeCustomerId, limit: 5 });
      invoices = inv.data.map((i) => ({
        id: i.id,
        amount: i.amount_paid / 100,
        currency: i.currency,
        status: i.status,
        date: new Date(i.created * 1000).toISOString(),
        pdf: i.invoice_pdf,
      }));
    } catch { /* Stripe key not set in dev */ }
  }

  return {
    plan: team.plan,
    subscriptionStatus: team.subscriptionStatus,
    hasSubscription: !!team.stripeSubscriptionId,
    invoices,
    limits: team.getPlanLimits ? team.getPlanLimits() : {},
  };
}

module.exports = { createCheckoutSession, createPortalSession, handleWebhook, getBillingStatus };
