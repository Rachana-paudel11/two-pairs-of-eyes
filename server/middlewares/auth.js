import { verifyToken } from '../utils/token.js';
import { logSecurityEvent } from '../utils/logger.js';

/**
 * Extracts and verifies auth token from Authorization header or cookie.
 * Attaches decoded user payload to req.user.
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
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

  const decoded = verifyToken(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  // Standardize user role
  let role = (decoded.role || 'TRAINEE').toUpperCase();
  if (role.includes('TRAINEE')) role = 'TRAINEE';
  else if (role.includes('TRAINER') || role.includes('SUPERVISOR')) role = 'TRAINER';
  else if (role.includes('ADMIN')) role = 'ADMIN';

  req.user = {
    ...decoded,
    role
  };

  next();
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
        error: 'Unauthorized: Authentication is required to access this resource.'
      });
    }
    next();
  });
}

/**
 * Middleware: Requires one of the specified roles.
 * Responds with HTTP 403 if role is insufficient.
 * @param  {...string} allowedRoles (e.g. 'TRAINER', 'ADMIN')
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => {
    const u = r.toUpperCase();
    if (u.includes('TRAINEE')) return 'TRAINEE';
    if (u.includes('TRAINER') || u.includes('SUPERVISOR')) return 'TRAINER';
    if (u.includes('ADMIN')) return 'ADMIN';
    return u;
  });

  return (req, res, next) => {
    requireAuth(req, res, () => {
      const userRole = req.user.role;
      if (!normalizedAllowed.includes(userRole)) {
        logSecurityEvent({
          action: 'AUTHZ_DENIED',
          outcome: 'FAILURE',
          userId: req.user.traineeId || req.user.userId,
          ip: req.ip,
          details: {
            path: req.originalUrl,
            userRole,
            requiredRoles: normalizedAllowed
          }
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to access this resource.'
        });
      }
      next();
    });
  };
}
