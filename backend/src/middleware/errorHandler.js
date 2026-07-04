const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  if (err.name === 'ValidationError') {
    return sendError(res, err.message, 422);
  }

  if (err.name === 'UnauthorizedError') {
    return sendError(res, 'Unauthorized', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};

const notFound = (req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFound };
