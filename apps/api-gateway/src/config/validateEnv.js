const requiredEnvVars = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET_PRIVATE',
  'JWT_REFRESH_SECRET',
  'ORCHESTRATOR_URL',
];

function validateEnv() {
  const missing = requiredEnvVars.filter((name) => {
    const value = process.env[name];
    return !value || !String(value).trim();
  });

  if (missing.length > 0) {
    const error = new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
    error.code = 'ENV_VALIDATION_ERROR';
    throw error;
  }
}

module.exports = { validateEnv, requiredEnvVars };
