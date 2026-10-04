import { logSecurityEvent } from '../utils/logger.js';

/**
 * Creates an in-memory rate limiting middleware.
 * @param {object} options
 * @param {number} [options.windowMs=60000] - Window in milliseconds (default: 1 minute)
 * @param {number} [options.maxRequests=10] - Max requests allowed in window (default: 10)
 * @param {string} [options.message] - Custom error message
 * @returns {Function} Express middleware
 */
export function createRateLimiter({
  windowMs = 60000,
  maxRequests = 10,
  message = 'Too many requests. Please try again later.'
} = {}) {
  const requests = new Map();

  // Periodic cleanup of expired records every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requests.entries()) {
      if (now - entry.windowStart > windowMs) {
        requests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let entry = requests.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 1 };
      requests.set(ip, entry);
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      logSecurityEvent({
        action: 'RATE_LIMIT_EXCEEDED',
        outcome: 'WARNING',
        ip,
        details: { path: req.originalUrl, count: entry.count, limit: maxRequests }
      });

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    next();
  };
}
