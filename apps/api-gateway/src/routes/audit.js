const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv'); // Might need this package or just write it manually
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/export', requireAuth, requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    const query = { teamId: req.user.teamId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();

    if (format === 'csv') {
      try {
        const csv = parse(logs, { fields: ['timestamp', 'userId', 'action', 'resource', 'resourceId', 'ip', 'userAgent'] });
        res.header('Content-Type', 'text/csv');
        res.attachment('audit-logs.csv');
        return res.send(csv);
      } catch (err) {
        // Fallback if json2csv not installed
        res.status(500).json({ success: false, error: 'CSV export requires json2csv package' });
      }
    }

    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

router.post('/gdpr/export', requireAuth, async (req, res, next) => {
  try {
    // Collect all data for the user
    const user = await User.findById(req.user._id).lean();
    const workflows = await Workflow.find({ userId: req.user._id }).lean();
    const executions = await Execution.find({ triggeredBy: req.user._id }).lean();
    const auditLogs = await AuditLog.find({ userId: req.user._id }).lean();
    
    const gdprData = {
      user,
      workflows,
      executions,
      auditLogs
    };

    res.header('Content-Type', 'application/json');
    res.attachment('gdpr-export.json');
    res.send(JSON.stringify(gdprData, null, 2));
  } catch (err) {
    next(err);
  }
});

router.post('/gdpr/delete', requireAuth, async (req, res, next) => {
  try {
    // Schedule deletion - in reality we'd flag the user account as "pending_deletion"
    // and a cron job would purge it after 30 days.
    
    await User.findByIdAndUpdate(req.user._id, { 
      scheduledForDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
    });
    
    // Log the request
    await AuditLog.create({
      userId: req.user._id,
      teamId: req.user.teamId,
      action: 'delete_request',
      resource: 'User',
      resourceId: req.user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, message: 'Account scheduled for deletion in 30 days.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
