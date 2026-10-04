import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../utils/logger.js';
import { verifyToken as verifyTokenCustom } from '../utils/token.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';

/**
 * Extracts and verifies auth token from Authorization header or cookie.
 * Attaches decoded user payload to req.user on success.
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Authorization: Bearer <token>
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  }

  // 2. Cookie fallback: technova_auth_token
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const [key, value] = c.trim().split('=');
      if (key === 'technova_auth_token' && value) {
        token = decodeURIComponent(value);
        break;
      }
    }
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Try standard jsonwebtoken verification
    const decoded = jwt.verify(token, JWT_SECRET);
    const rawRole = (decoded.role || 'trainee').toLowerCase();
    req.user = {
      ...decoded,
      traineeId: decoded.sub || decoded.traineeId,
      userId: decoded.userId || decoded.sub,
      role: rawRole,
      ROLE: rawRole.toUpperCase()
    };
    return next();
  } catch (err) {
    // Fallback to custom token verification if needed
    const customDecoded = verifyTokenCustom(token, JWT_SECRET);
    if (customDecoded) {
      const rawRole = (customDecoded.role || 'trainee').toLowerCase();
      req.user = {
        ...customDecoded,
        traineeId: customDecoded.traineeId || customDecoded.sub,
        userId: customDecoded.userId || customDecoded.traineeId,
        role: rawRole,
        ROLE: rawRole.toUpperCase()
      };
      return next();
    }

    req.user = null;
    return next();
  }
}

/**
 * Middleware: Requires a valid authenticated session.
 * Responds with HTTP 401 if not authenticated.
 */
export function requireAuth(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user) {
      logSecurityEvent({
        action: 'AUTH_REQUIRED',
        outcome: 'FAILURE',
        userId: 'ANONYMOUS',
        ip: req.ip,
        details: { path: req.originalUrl, method: req.method }
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required. Please log in.'
      });
    }
    next();
  });
}

/**
 * Middleware: Requires one of the specified roles (case-insensitive).
 * Responds with HTTP 403 if role is insufficient.
 * @param  {...string} allowedRoles (e.g. 'trainer', 'admin')
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

  return (req, res, next) => {
    requireAuth(req, res, () => {
      const userRole = (req.user?.role || '').toLowerCase();
      const hasPermission = normalizedAllowed.includes(userRole) ||
        (normalizedAllowed.includes('trainer') && userRole === 'supervisor') ||
        (normalizedAllowed.includes('admin') && userRole === 'administrator');

      if (!hasPermission) {
        logSecurityEvent({
          action: 'AUTHZ_DENIED',
          outcome: 'FAILURE',
          userId: req.user?.traineeId || req.user?.userId || 'UNKNOWN',
          ip: req.ip,
          details: {
            path: req.originalUrl,
            userRole,
            requiredRoles: allowedRoles
          }
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Access denied. Insufficient permissions.'
        });
      }
      next();
    });
  };
}
