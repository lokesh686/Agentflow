const { createClient } = require('redis');

let client;

async function connectRedis() {
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  console.log('Redis connected');
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis not initialized — call connectRedis() first');
  return client;
}

async function getRedisStatus() {
  if (!client) return 'error';
  try {
    await client.ping();
    return 'ok';
  } catch (err) {
    return 'error';
  }
}

module.exports = { connectRedis, getRedis, getRedisStatus };
