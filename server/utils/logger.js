/**
 * logger.js
 * Security audit logger for Two Pairs of Eyes.
 * Logs structured security events without exposing sensitive tokens, credentials, or personal secrets.
 */

/**
 * Logs a security audit event in structured JSON / readable format.
 * @param {object} params
 * @param {string} params.action - Event name (e.g. AUTH_LOGIN, AUTH_REGISTER, AUTHZ_DENIED, REPORT_SUBMITTED)
 * @param {'SUCCESS'|'FAILURE'|'WARNING'} params.outcome
 * @param {string} [params.userId] - Identifier of user (e.g. TR-10001)
 * @param {string} [params.ip] - Client IP address
 * @param {object} [params.details] - Safe contextual metadata (NO PASSWORDS, TOKENS, OR SECRETS)
 */
export function logSecurityEvent({ action, outcome, userId = 'ANONYMOUS', ip = 'UNKNOWN', details = {} }) {
  // Sanitize details to guarantee sensitive fields are never logged
  const safeDetails = { ...details };
  delete safeDetails.password;
  delete safeDetails.token;
  delete safeDetails.secret;
  delete safeDetails.authorization;
  delete safeDetails.cookie;

  const event = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY_AUDIT',
    action,
    outcome,
    userId,
    ip,
    details: safeDetails
  };

  const formattedMessage = `[SECURITY AUDIT] ${event.timestamp} [${event.action}] outcome=${event.outcome} user=${event.userId} ip=${event.ip}`;

  if (outcome === 'FAILURE') {
    console.warn(formattedMessage, safeDetails);
  } else {
    console.log(formattedMessage, safeDetails);
  }
}
