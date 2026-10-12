import crypto from 'crypto';

// In-memory token store for active admin sessions: token -> { adminId, username, name, role, expiresAt }
const activeSessions = new Map();
const revokedTokens = new Set();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SECRET_KEY = process.env.ADMIN_SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => {
        console.warn('[Admin Security Warning] ADMIN_SESSION_SECRET is not configured in production environment.');
        return 'technova-two-pair-of-eyes-admin-secret-2026';
      })()
    : 'technova-two-pair-of-eyes-admin-secret-2026'
);

/**
 * Generates an authenticated session token for an admin user.
 */
export function createAdminSession(admin) {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now();
  const rawPayload = `${admin._id || admin.id || 'admin'}:${admin.username}:${timestamp}:${randomBytes}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(rawPayload).digest('hex');
  const token = `${Buffer.from(rawPayload).toString('base64url')}.${signature}`;

  const sessionData = {
    adminId: (admin._id || admin.id || 'admin').toString(),
    username: admin.username,
    name: admin.name || 'System Administrator',
    role: admin.role || 'System Administrator',
    expiresAt: timestamp + SESSION_TTL_MS
  };

  activeSessions.set(token, sessionData);
  return { token, session: sessionData };
}

/**
 * Validates and retrieves the admin session associated with a token.
 */
export function validateAdminSession(token) {
  if (!token || typeof token !== 'string') return null;
  if (revokedTokens.has(token)) return null;

  const session = activeSessions.get(token);
  if (!session) {
    // If server restarted, check HMAC signature to allow valid stateless fallback
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    try {
      const rawPayload = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(rawPayload).digest('hex');
      if (signature !== expectedSig) return null;

      const [adminId, username, timestampStr] = rawPayload.split(':');
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp) || Date.now() - timestamp > SESSION_TTL_MS) {
        return null;
      }

      const recoveredSession = {
        adminId,
        username,
        name: 'System Administrator',
        role: 'System Administrator',
        expiresAt: timestamp + SESSION_TTL_MS
      };
      activeSessions.set(token, recoveredSession);
      return recoveredSession;
    } catch {
      return null;
    }
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Invalidates an active admin token (Logout).
 */
export function destroyAdminSession(token) {
  if (!token) return false;
  revokedTokens.add(token);
  return activeSessions.delete(token);
}

/**
 * Express middleware to protect administrative routes.
 */
export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication token is missing.'
    });
  }

  const session = validateAdminSession(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired admin session token.'
    });
  }

  req.admin = session;
  req.adminToken = token;
  next();
}
