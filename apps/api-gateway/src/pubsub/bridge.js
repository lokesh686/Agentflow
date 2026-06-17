/**
 * Task 5 — Redis Pub/Sub → Socket.io bridge
 *
 * This module runs inside the Node.js API Gateway.
 * It subscribes to Redis pub/sub channels and forwards
 * execution events to connected browser clients via Socket.io.
 *
 * Flow:
 *   Orchestrator  →  Redis pub/sub  →  Bridge  →  Socket.io  →  Browser
 *
 * Usage: imported in src/index.js and started with startPubSubBridge(io)
 */

const { createClient } = require('redis');
const Execution = require('../models/Execution');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Pattern subscriptions — matches execution:*:events and team:*:events
const PATTERNS = ['execution:*:events', 'team:*:events'];

/**
 * Start the Redis pub/sub bridge.
 * @param {import('socket.io').Server} io  Socket.io server instance
 */
async function startPubSubBridge(io) {
  // Create a dedicated subscriber client (cannot be used for commands)
  const subscriber = createClient({ url: REDIS_URL });

  subscriber.on('error', (err) => {
    console.error('[PubSub Bridge] Redis subscriber error:', err.message);
  });

  await subscriber.connect();
  console.log('[PubSub Bridge] Connected to Redis, subscribing to patterns...');

  // Subscribe to execution and team event patterns
  await subscriber.pSubscribe(PATTERNS, async (message, channel) => {
    try {
      const event = JSON.parse(message);
      const executionId = event.execution_id;

      if (!executionId) return;

      // Forward to all sockets in the execution room
      io.to(`execution:${executionId}`).emit('execution:event', event);

      // Also forward to team room if team_id is available
      const teamId = extractTeamId(channel, event);
      if (teamId) {
        io.to(`team:${teamId}`).emit('execution:event', event);
      }

      // Emit specific typed events for easier client-side handling
      switch (event.type) {
        case 'step':
          io.to(`execution:${executionId}`).emit('execution:step', {
            executionId,
            step: event.payload,
            timestamp: event.timestamp,
          });
          break;

        case 'status':
          io.to(`execution:${executionId}`).emit('execution:status', {
            executionId,
            status: event.payload.status,
            error: event.payload.error,
            timestamp: event.timestamp,
          });
          break;

        case 'done':
          io.to(`execution:${executionId}`).emit('execution:done', {
            executionId,
            finalOutput: event.payload.finalOutput,
            estimatedCostUsd: event.payload.estimatedCostUsd,
            timestamp: event.timestamp,
          });
          // Handle bidirectional callback if exists
          await handleExecutionCallback(executionId, 'completed', event.payload.finalOutput);
          break;

        case 'error':
          io.to(`execution:${executionId}`).emit('execution:error', {
            executionId,
            error: event.payload.error,
            timestamp: event.timestamp,
          });
          // Handle bidirectional callback for errors
          await handleExecutionCallback(executionId, 'failed', null, event.payload.error);
          break;

        case 'approval_required':
          io.to(`execution:${executionId}`).emit('execution:approval_required', {
            executionId,
            agentName: event.payload.agentName,
            context: event.payload.context,
            options: event.payload.options,
            timestamp: event.timestamp,
          });
          break;
      }
    } catch (err) {
      console.error('[PubSub Bridge] Failed to process message:', err.message);
    }
  });

  console.log(`[PubSub Bridge] Subscribed to patterns: ${PATTERNS.join(', ')}`);
  return subscriber;
}

/**
 * Handle outbound callback for bidirectional integration.
 */
async function handleExecutionCallback(executionId, status, output, error = null) {
  try {
    const execution = await Execution.findById(executionId);
    if (execution && execution.callbackUrl) {
      console.log(`[Callback] Dispatching to ${execution.callbackUrl} for execution ${executionId}`);
      
      const body = {
        executionId,
        status,
        output,
        token_usage: execution.totalTokens,
        cost: execution.estimatedCostUsd
      };
      
      if (error) body.error = error;

      await fetch(execution.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
  } catch (err) {
    console.error(`[Callback] Failed to dispatch for execution ${executionId}:`, err.message);
  }
}

/**
 * Extract team ID from channel name or event payload.
 * Channel format: team:<teamId>:events
 */
function extractTeamId(channel, event) {
  const teamMatch = channel.match(/^team:(.+):events$/);
  if (teamMatch) return teamMatch[1];
  return null;
}

module.exports = { startPubSubBridge };
