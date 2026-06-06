function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, error: `${field} already exists` });
  }

  // JWT errors (if not caught earlier)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  // Default
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: status < 500 ? err.message : 'Internal server error',
  });
}

module.exports = { errorHandler };
