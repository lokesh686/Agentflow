const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const FROM = `"AgentFlow Pro" <${process.env.SMTP_USER || 'noreply@agentflowpro.io'}>`;
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function sendVerificationEmail(email, name, token) {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your AgentFlow Pro account',
    html: `
      <p>Hi ${name},</p>
      <p>Thanks for signing up! Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>— The AgentFlow Pro Team</p>
    `,
  });
}

async function sendPasswordResetEmail(email, name, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your AgentFlow Pro password',
    html: `
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click below to set a new one:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
      <p>— The AgentFlow Pro Team</p>
    `,
  });
}

async function sendTeamInviteEmail(email, inviterName, teamName, token) {
  const link = `${BASE_URL}/accept-invite?token=${token}`;
  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `${inviterName} invited you to join ${teamName} on AgentFlow Pro`,
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on AgentFlow Pro.</p>
      <p><a href="${link}">Accept Invitation</a></p>
      <p>This link expires in 48 hours.</p>
      <p>— The AgentFlow Pro Team</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendTeamInviteEmail };
