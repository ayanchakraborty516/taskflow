import { TooManyRequestsError } from '../utils/api-error.util.js';
import env from '../config/env.config.js';

/**
 * In-memory sliding window rate limiter for security-sensitive endpoints (login, register).
 * Disabled in test environment.
 *
 * @param {number} maxRequests - Max requests allowed within windowMs (default: 20)
 * @param {number} windowMs - Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export const rateLimit = (maxRequests = 20, windowMs = 60 * 1000) => {
  const ipHits = new Map();

  // Periodic cleanup of expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipHits.entries()) {
      const validTimestamps = timestamps.filter((time) => now - time < windowMs);
      if (validTimestamps.length === 0) {
        ipHits.delete(ip);
      } else {
        ipHits.set(ip, validTimestamps);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    if (env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const timestamps = (ipHits.get(ip) || []).filter((time) => now - time < windowMs);

    if (timestamps.length >= maxRequests) {
      return next(
        new TooManyRequestsError('Too many attempts from this IP. Please try again after a minute.')
      );
    }

    timestamps.push(now);
    ipHits.set(ip, timestamps);

    next();
  };
};

export default rateLimit;

