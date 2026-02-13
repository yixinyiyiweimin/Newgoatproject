// Global error handler middleware
// Must be registered last with app.use(errorHandler)

module.exports = function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);

  // Axios errors from PostgREST
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;
    return res.status(status).json({
      message: data?.message || data?.details || 'Database request failed',
      hint: data?.hint
    });
  }

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      message: err.details.map(d => d.message).join(', ')
    });
  }

  // Default
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
};
