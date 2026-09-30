/**
 * validators.js
 * Input validation, regex sanitization, and result integrity checks.
 */

// Known valid scenario definitions for Two Pairs of Eyes
const VALID_STOP_IDS = new Set(['stop_01', 'stop_02', 'stop_03', 'stop_04', 'stop_05']);
const VALID_ACTION_IDS = new Set([
  'cordon_off',
  'report_only',
  'ignore',
  'hold_position',
  'proceed_carefully',
  'walk_straight_through',
  'isolate_and_report',
  'emergency_drill',
  'continue_on'
]);
const VALID_TIERS = new Set(['optimal', 'partial', 'neutral', 'failure']);

/**
 * Escapes special regex characters in a string to prevent ReDoS / unintended regex execution.
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a password against the security policy.
 * - Minimum: 12 characters
 * - Maximum: 128 characters
 * - Does not trim or modify password
 * - Allows any characters/symbols/passphrases
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string.' };
  }
  if (password.length === 0) {
    return { valid: false, error: 'Password cannot be empty.' };
  }
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters.' };
  }
  return { valid: true };
}

/**
 * Sanitizes and validates trainee identifiers.
 * Expected format: TR- followed by alphanumerics, or standard alphanumeric username (max 50 chars).
 * @param {string} identifier
 * @returns {boolean}
 */
export function isValidIdentifier(identifier) {
  if (typeof identifier !== 'string') return false;
  const trimmed = identifier.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  // Allow letters, numbers, hyphens, underscores, spaces
  return /^[a-zA-Z0-9_\- ]+$/.test(trimmed);
}

/**
 * Validates an inspection report submission for score and payload integrity.
 * @param {object} payload
 * @param {object} [authenticatedUser]
 * @returns {{ valid: boolean, error?: string, sanitizedData?: object }}
 */
export function validateReportPayload(payload, authenticatedUser = null) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const {
    traineeId,
    traineeName,
    totalScore,
    maxScore = 25,
    passMark = 18,
    tierCounts = {},
    zoneLogs = [],
    flags = [],
    triggeredRules = [],
    supervisorReaction
  } = payload;

  // 1. Trainee ID verification
  if (!traineeId || typeof traineeId !== 'string') {
    return { valid: false, error: 'Valid traineeId is required.' };
  }

  // If authenticated user is a Trainee, they CANNOT submit results for a different traineeId
  if (authenticatedUser) {
    const userRole = (authenticatedUser.role || '').toUpperCase();
    const isPrivileged = userRole === 'TRAINER' || userRole === 'ADMIN' || userRole === 'SUPERVISOR';
    if (!isPrivileged && authenticatedUser.traineeId && authenticatedUser.traineeId !== traineeId) {
      return { valid: false, error: 'Forbidden: Cannot submit inspection results for another trainee.' };
    }
  }

  // 2. Score bounds verification
  if (typeof totalScore !== 'number' || Number.isNaN(totalScore)) {
    return { valid: false, error: 'totalScore must be a valid number.' };
  }
  if (totalScore < 0) {
    return { valid: false, error: 'totalScore cannot be negative in verified certification report.' };
  }
  if (totalScore > 25) {
    return { valid: false, error: 'totalScore cannot exceed scenario maximum score of 25.' };
  }

  // 3. Scenario parameters verification
  if (typeof maxScore !== 'number' || maxScore !== 25) {
    return { valid: false, error: 'maxScore must equal scenario definition (25).' };
  }
  if (typeof passMark !== 'number' || passMark !== 18) {
    return { valid: false, error: 'passMark must equal scenario definition (18).' };
  }

  // 4. Zone logs verification
  if (!Array.isArray(zoneLogs)) {
    return { valid: false, error: 'zoneLogs must be an array.' };
  }
  for (const log of zoneLogs) {
    if (!log || typeof log !== 'object') {
      return { valid: false, error: 'Each zoneLog entry must be an object.' };
    }
    if (log.stopId && !VALID_STOP_IDS.has(log.stopId)) {
      return { valid: false, error: `Invalid stopId in zoneLogs: ${log.stopId}` };
    }
    if (log.actionId && !VALID_ACTION_IDS.has(log.actionId)) {
      return { valid: false, error: `Invalid actionId in zoneLogs: ${log.actionId}` };
    }
    if (log.tier && !VALID_TIERS.has(log.tier)) {
      return { valid: false, error: `Invalid tier in zoneLogs: ${log.tier}` };
    }
  }

  // 5. Authoritative server-side calculation of pass status
  const failureCount = typeof tierCounts.failure === 'number' ? tierCounts.failure : 0;
  const serverCalculatedPassed = totalScore >= passMark && failureCount === 0;

  // 6. Rank title derivation
  const rankTitle = serverCalculatedPassed ? 'Safety Champion' : 'Hazards Overlooked';

  return {
    valid: true,
    sanitizedData: {
      traineeId: traineeId.trim(),
      traineeName: (typeof traineeName === 'string' && traineeName.trim()) ? traineeName.trim().slice(0, 80) : 'Alex',
      totalScore,
      maxScore: 25,
      passMark: 18,
      passed: serverCalculatedPassed,
      rankTitle,
      rankSubtitle: typeof payload.rankSubtitle === 'string' ? payload.rankSubtitle.slice(0, 150) : '',
      tierCounts: {
        optimal: Math.max(0, parseInt(tierCounts.optimal, 10) || 0),
        partial: Math.max(0, parseInt(tierCounts.partial, 10) || 0),
        neutral: Math.max(0, parseInt(tierCounts.neutral, 10) || 0),
        failure: Math.max(0, failureCount)
      },
      zoneLogs: zoneLogs.slice(0, 10),
      flags: Array.isArray(flags) ? flags.filter(f => typeof f === 'string').slice(0, 20) : [],
      triggeredRules: Array.isArray(triggeredRules) ? triggeredRules.filter(r => typeof r === 'string').slice(0, 20) : [],
      supervisorReaction: typeof supervisorReaction === 'string' ? supervisorReaction.slice(0, 100) : ''
    }
  };
}
