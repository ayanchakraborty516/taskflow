import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.util.js';
import logger from '../utils/logger.util.js';

export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Zod validation error
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }

  // Prisma unique constraint violation (P2002)
  if (err.code === 'P2002') {
    statusCode = 400;
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
    message = `Duplicate value entered for ${target}. Please use another value.`;
  }

  // Prisma record not found (P2025)
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Resource not found.';
  }

  // Prisma foreign key constraint violation (P2003)
  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Referenced entity does not exist.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid session token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please log in again.';
  }

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled Server Error');
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 ? { errors } : {}),
  });
};

export default errorMiddleware;

