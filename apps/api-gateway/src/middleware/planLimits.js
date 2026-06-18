const UsageRecord = require('../models/UsageRecord');
const Team = require('../models/Team');

const PLAN_LIMITS = {
  free: { executions: 100, tokens: 10000 },
  pro: { executions: 2000, tokens: 200000 },
  team: { executions: 10000, tokens: 1000000 },
};

const checkPlanLimits = async (req, res, next) => {
  try {
    const team = await Team.findById(req.user.teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const plan = team.billing.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    if (!limits) {
      return next(); // No limits for this plan
    }

    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usage = await UsageRecord.findOne({ teamId: req.user.teamId, period });

    if (usage) {
      if (usage.executions >= limits.executions) {
        return res.status(429).json({ message: 'Execution limit reached for this month.' });
      }
      if (usage.tokens >= limits.tokens) {
        return res.status(429).json({ message: 'Token limit reached for this month.' });
      }
    }

    next();
  } catch (error) {
    console.error('Error checking plan limits:', error);
    res.status(500).json({ message: 'Error checking plan limits' });
  }
};

module.exports = { checkPlanLimits };
