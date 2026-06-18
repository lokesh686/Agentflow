const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Execution = require('../models/Execution');

router.post('/:id/:decision', protect, async (req, res) => {
  try {
    const { id, decision } = req.params;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }

    const execution = await Execution.findById(id);
    if (!execution) {
      return res.status(404).json({ message: 'Execution not found' });
    }

    if (execution.status !== 'WAITING_FOR_APPROVAL') {
      return res.status(400).json({ message: 'Execution is not waiting for approval' });
    }

    execution.humanApproval.decision = decision;
    execution.humanApproval.respondedAt = new Date();
    execution.humanApproval.respondedBy = req.user.id;
    execution.transition('RUNNING');
    await execution.save();

    const io = req.app.get('io');
    io.to(`execution:${id}`).emit('execution:status', { status: 'RUNNING' });

    res.json(execution);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
