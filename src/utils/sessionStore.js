/**
 * sessionStore.js
 *
 * Lightweight browser-session checkpoint store.
 * Allows seamless resumption of an active safety patrol upon page reload/refresh
 * without kicking the trainee back to the login screen.
 */

const SESSION_KEY = 'technova_safety_session_checkpoint';

/**
 * Saves or updates the current simulation checkpoint in sessionStorage.
 * @param {Object} data
 */
export function saveSessionCheckpoint(data = {}) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const existing = loadSessionCheckpoint() || {};
    const updated = {
      ...existing,
      ...data,
      timestamp: Date.now()
    };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('has-active-session');
    }
  } catch (err) {
    console.warn('[SessionStore] Failed to save session checkpoint:', err);
  }
}

/**
 * Loads the active simulation checkpoint from sessionStorage.
 * Returns null if no active session exists or if the session is completed.
 * @returns {Object|null}
 */
export function loadSessionCheckpoint() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.isComplete) return null;
    return parsed;
  } catch (err) {
    console.warn('[SessionStore] Failed to load session checkpoint:', err);
    return null;
  }
}

/**
 * Clears the active simulation checkpoint (e.g. upon patrol completion or restart).
 */
export function clearSessionCheckpoint() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(SESSION_KEY);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('has-active-session');
    }
  } catch (err) {
    console.warn('[SessionStore] Failed to clear session checkpoint:', err);
  }
}
