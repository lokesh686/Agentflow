const { validateEnv, requiredEnvVars } = require('../config/validateEnv');

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws with missing env vars', () => {
    for (const key of requiredEnvVars) {
      delete process.env[key];
    }

    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });

  it('passes when required env vars are provided', () => {
    for (const key of requiredEnvVars) {
      process.env[key] = 'test-value';
    }

    expect(() => validateEnv()).not.toThrow();
  });
});
