require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { validateEnv } = require('./config/validateEnv');
const { connectDB, getMongoStatus } = require('./config/db');
const { connectRedis, getRedisStatus } = require('./config/redis');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const workflowRoutes = require('./routes/workflows');
const executionRoutes = require('./routes/executions');
const billingRoutes = require('./routes/billing');
const approvalRoutes = require('./routes/approvals');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const helmet = require('helmet');
const { startPubSubBridge } = require('./pubsub/bridge');
const logger = require('./config/logger');

const app = express();
const server = http.createServer(app);
const startedAtMs = Date.now();

// Socket.io for real-time execution streaming
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }
});
app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimiter);
app.use(helmet());

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/auth/oauth', oauthRoutes);
app.use('/v1/workflows', workflowRoutes);
app.use('/v1/executions', executionRoutes);
app.use('/v1/billing', billingRoutes);
app.use('/v1/approvals', approvalRoutes);

// Health check
app.get('/health', async (req, res) => {
  const mongo = getMongoStatus();
  const redis = await getRedisStatus();
  let orchestrator = 'error';
  try {
    const healthUrl = `${process.env.ORCHESTRATOR_URL.replace(/\/$/, '')}/health`;
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    orchestrator = response.ok ? 'ok' : 'error';
  } catch (err) {
    orchestrator = 'error';
  }

  res.json({
    mongo,
    redis,
    orchestrator,
    uptime_seconds: Math.floor((Date.now() - startedAtMs) / 1000),
  });
});

// Error handler (must be last)
app.use(errorHandler);

// WebSocket rooms per execution
io.on('connection', (socket) => {
  socket.on('join:execution', (executionId) => {
    socket.join(`execution:${executionId}`);
  });
  socket.on('leave:execution', (executionId) => {
    socket.leave(`execution:${executionId}`);
  });
  socket.on('join:team', (teamId) => {
    socket.join(`team:${teamId}`);
  });
  socket.on('leave:team', (teamId) => {
    socket.leave(`team:${teamId}`);
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  validateEnv();
  await connectDB();
  await connectRedis();
  await startPubSubBridge(io);
  server.listen(PORT, () => {
    logger.info(`AgentFlow API Gateway running on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
