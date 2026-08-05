const { Prisma } = require('@prisma/client');
const { sendError } = require('../utils/response');
const { ApiError } = require('../utils/errors');
const config = require('../config');

/** Maps Prisma's constraint errors onto meaningful HTTP statuses. */
const fromPrisma = (err) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (err.code) {
    case 'P2002':
      return { status: 409, message: 'A record with these details already exists' };
    case 'P2003':
      return { status: 400, message: 'Related record does not exist' };
    case 'P2025':
      return { status: 404, message: 'Record not found' };
    default:
      return null;
  }
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.statusCode, err.errors);
  }

  const prismaError = fromPrisma(err);
  if (prismaError) {
    return sendError(res, prismaError.message, prismaError.status);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid request payload', 400);
  }

  if (!config.isTest) {
    console.error('❌ Unhandled error:', err);
  }

  const statusCode = err.statusCode || 500;
  const message =
    config.env === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};

const notFound = (req, res) => sendError(res, `Route ${req.originalUrl} not found`, 404);

module.exports = { errorHandler, notFound };
