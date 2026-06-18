const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/email');
const User = require('../models/User');
const Team = require('../models/Team');

const router = express.Router();

// Invite user to team (Admins and Owners only)
router.post('/invite', requireAuth, requireRole('admin'), auditLogger('Team'), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, error: 'Email and role required' });
    }

    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

    // Ensure the inviter isn't trying to invite an owner if they are just an admin
    if (role === 'owner' && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can invite owners' });
    }

    const inviteToken = jwt.sign(
      { email, role, teamId: team._id.toString(), type: 'invite' },
      process.env.JWT_SECRET_PRIVATE,
      { algorithm: 'RS256', expiresIn: '48h' }
    );

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/team/join?token=${inviteToken}`;

    await sendEmail({
      to: email,
      subject: `You've been invited to join ${team.name} on AgentFlow Pro`,
      html: `<p>You have been invited to join <strong>${team.name}</strong> as a ${role}.</p>
             <p>Click the link below to accept the invitation and join the team. This link expires in 48 hours.</p>
             <a href="${inviteLink}">Join Team</a>`
    });

    res.json({ success: true, message: 'Invite sent' });
  } catch (err) {
    next(err);
  }
});

// Accept team invite
router.post('/join', requireAuth, auditLogger('Team'), async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET_PUBLIC, { algorithms: ['RS256'] });
    if (decoded.type !== 'invite') {
      return res.status(400).json({ success: false, error: 'Invalid token type' });
    }

    if (decoded.email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Invite token email mismatch' });
    }

    const user = await User.findById(req.user.sub);
    const team = await Team.findById(decoded.teamId);

    if (!user || !team) {
      return res.status(404).json({ success: false, error: 'User or Team not found' });
    }

    user.teamId = team._id;
    user.role = decoded.role;
    await user.save();

    team.members.push({ userId: user._id, role: decoded.role });
    await team.save();

    res.json({ success: true, message: 'Joined team successfully' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, error: 'Invite token expired' });
    }
    next(err);
  }
});

module.exports = router;
