/**
 * api.js
 * Client communication layer with Two Pairs of Eyes Backend (MongoDB).
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Persists an inspection debrief report into MongoDB.
 * Gracefully handles offline states without breaking the simulation UI.
 *
 * @param {object} reportPayload
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function saveInspectionReport(reportPayload) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportPayload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Server responded with ${response.status}`
      };
    }

    const data = await response.json();
    return { success: true, data: data.data };
  } catch (err) {
    console.warn('[API] Could not persist report to MongoDB (server offline or unreachable):', err.message);
    return { success: false, error: err.message, offline: true };
  }
}

/**
 * Fetch safety statistics from MongoDB.
 */
export async function getInspectionStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/stats`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.stats;
  } catch {
    return null;
  }
}
