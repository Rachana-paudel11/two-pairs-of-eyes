import crypto from 'crypto';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'two-pairs-of-eyes-development-fallback-secret-2026';
const DEFAULT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Encodes an object to a URL-safe Base64 string.
 * @param {object} obj
 * @returns {string}
 */
function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decodes a URL-safe Base64 string to an object.
 * @param {string} str
 * @returns {object}
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

/**
 * Creates an HMAC-SHA256 signature for a token payload.
 * @param {string} data
 * @param {string} secret
 * @returns {string}
 */
function createSignature(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Issues a signed HMAC-SHA256 JWT-compatible token.
 * @param {object} payload
 * @param {string} [secret]
 * @param {number} [expiresInSeconds]
 * @returns {string}
 */
export function signToken(payload, secret = DEFAULT_SECRET, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(fullPayload);
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a signed HMAC-SHA256 token.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {string} token
 * @param {string} [secret]
 * @returns {object|null} Decoded payload if valid, null otherwise
 */
export function verifyToken(token, secret = DEFAULT_SECRET) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  try {
    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = base64UrlDecode(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }

    return payload;
  } catch {
    return null;
  }
}
