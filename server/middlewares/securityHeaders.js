/**
 * securityHeaders.js
 * Sets standard HTTP security response headers while preserving compatibility
 * with Three.js WebGL canvas rendering, GLB models, textures, and fonts.
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing / clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Modern browsers disable legacy buggy XSS filters
  res.setHeader('X-XSS-Protection', '0');

  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict unneeded browser feature APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Remove Express fingerprint header
  res.removeHeader('X-Powered-By');

  // Enforce HSTS only in production HTTPS environments
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
