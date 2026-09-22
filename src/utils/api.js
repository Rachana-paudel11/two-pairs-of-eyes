/**
 * api.js
 * Unified persistence & communication layer for Two Pairs of Eyes.
 * 
 * Uses client-side IndexedDB as the primary offline-first storage engine,
 * with graceful hybrid synchronization to the backend server when available.
 */

import {
  saveInspectionReportOffline,
  getInspectionStatsOffline,
  registerTraineeOffline,
  loginTraineeOffline,
  saveActiveSessionOffline,
  getActiveSessionOffline
} from './indexedDb.js';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

/**
 * Persists an inspection debrief report into IndexedDB (and optionally MongoDB).
 * Always succeeds locally via IndexedDB even when completely offline or statically deployed.
 *
 * @param {object} reportPayload
 * @returns {Promise<{success: boolean, source?: string, data?: object, error?: string}>}
 */
export async function saveInspectionReport(reportPayload) {
  // 1. Always commit immediately to local IndexedDB (instant, zero-latency)
  const localResult = await saveInspectionReportOffline(reportPayload);

  // 2. Best-effort background sync to backend server if reachable
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });
      if (response.ok) {
        const serverData = await response.json();
        console.log('[API] Report synchronized with backend server successfully');
        return { success: true, source: 'synced', data: serverData.data || localResult.data };
      }
    } catch {
      // Backend offline or unreachable - that's completely normal in offline/static environments
      console.info('[API] Backend unreachable; report securely persisted in client IndexedDB.');
    }
  }

  return localResult;
}

/**
 * Fetch safety inspection statistics (aggregated across completed patrols).
 * Defaults to IndexedDB when backend is offline.
 *
 * @param {string} [traineeId]
 * @returns {Promise<object|null>}
 */
export async function getInspectionStats(traineeId = null) {
  if (typeof fetch !== 'undefined') {
    try {
      const url = traineeId 
        ? `${API_BASE_URL}/reports/stats?traineeId=${encodeURIComponent(traineeId)}`
        : `${API_BASE_URL}/reports/stats`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.stats) return data.stats;
      }
    } catch {
      // fallback to indexedDB
    }
  }

  // Fallback to IndexedDB stats
  return await getInspectionStatsOffline(traineeId);
}

/**
 * Register a new trainee account.
 * Supports offline registration via IndexedDB with permanent generated ID.
 */
export async function registerTrainee({ name, password, department = 'Warehouse Logistics' }) {
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, department })
      });
      const data = await response.json();
      if (data && data.success) {
        return data;
      }
    } catch {
      // Backend offline - register via IndexedDB
    }
  }

  return await registerTraineeOffline({ name, password, department });
}

/**
 * Authenticate a trainee.
 * Authenticates against backend server or local IndexedDB store.
 */
export async function loginTrainee({ traineeId, password }) {
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traineeId, password })
      });
      const data = await response.json();
      if (data && data.success) {
        return data;
      }
    } catch {
      // Backend offline - verify credentials in IndexedDB
    }
  }

  return await loginTraineeOffline({ traineeId, password });
}

export { saveActiveSessionOffline, getActiveSessionOffline };
