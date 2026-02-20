module.exports = (err, req, res, next) => {
  console.error('[ERROR]', err);

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      message: err.details[0].message,
    });
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) {
    return res.status(409).json({
      message: 'Database constraint violation',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired',
    });
  }

  // Default error
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
};
