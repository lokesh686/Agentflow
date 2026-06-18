const rateLimit = require('express-rate-limit');

// General API rate limiter (applied globally, per IP)
// Per-token limits are enforced separately in requireAuth middleware
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,            // generous global cap; per-tier enforcement is token-level
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health',
});

// Strict limiter for auth endpoints — 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again in 15 minutes' },
});

// Very strict login limiter — 5 failed attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again in 15 minutes' },
});

module.exports = { rateLimiter, authLimiter, loginLimiter };
