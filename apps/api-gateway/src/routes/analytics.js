const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');

async function fetchQueueMetrics() {
  try {
    const orchestratorUrl = (process.env.ORCHESTRATOR_URL || 'http://localhost:8000').replace(/\/$/, '');
    const response = await fetch(`${orchestratorUrl}/api/queue/metrics`);
    if (response.ok) return await response.json();
  } catch (err) {
    console.error('Failed to fetch queue metrics from orchestrator:', err.message);
  }
  return { queue_depth: 0, oldest_job_age_ms: 0 };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [
      executionsToday,
      totalExecutions,
      successRate,
      avgDuration,
      queueMetrics,
      mostActiveWorkflows,
    ] = await Promise.all([
      Execution.countDocuments({ teamId: req.user.teamId, createdAt: { $gte: new Date(new Date() - 24 * 60 * 60 * 1000) } }),
      Execution.countDocuments({ teamId: req.user.teamId }),
      Execution.aggregate([
        { $match: { teamId: req.user.teamId, status: { $in: ['COMPLETED', 'FAILED'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Execution.aggregate([
        { $match: { teamId: req.user.teamId, durationMs: { $ne: null } } },
        { $group: { _id: null, avgDuration: { $avg: '$durationMs' } } },
      ]),
      fetchQueueMetrics(),
      Workflow.find({ teamId: req.user.teamId }).sort({ 'stats.totalExecutions': -1 }).limit(5),
    ]);

    const completed = successRate.find(r => r._id === 'COMPLETED')?.count || 0;
    const failed = successRate.find(r => r._id === 'FAILED')?.count || 0;

    res.json({
      executions: {
        total: totalExecutions,
        today: executionsToday,
        success_rate: (completed + failed) > 0 ? Math.round((completed / (completed + failed)) * 100) : null,
        avg_duration_ms: avgDuration[0]?.avgDuration || 0,
      },
      queue: queueMetrics,
      workflows: {
        most_active: mostActiveWorkflows,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics data' });
  }
});

module.exports = router;
