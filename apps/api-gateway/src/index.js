require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const connectRedis = require('./config/redis');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const workflowRoutes = require('./routes/workflows');
const executionRoutes = require('./routes/executions');
const billingRoutes = require('./routes/billing');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { startPubSubBridge } = require('./pubsub/bridge');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time execution streaming
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }
});
app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/auth/oauth', oauthRoutes);
app.use('/v1/workflows', workflowRoutes);
app.use('/v1/executions', executionRoutes);
app.use('/v1/billing', billingRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

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
});

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();
  await connectRedis();
  await startPubSubBridge(io);
  server.listen(PORT, () => {
    console.log(`AgentFlow API Gateway running on port ${PORT}`);
  });
}

start();
