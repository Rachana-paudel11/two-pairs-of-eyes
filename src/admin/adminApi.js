/**
 * adminApi.js
 * API communication layer for System Administrator module.
 */

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

function getAuthHeader() {
  const token = localStorage.getItem('technova_admin_token') || sessionStorage.getItem('technova_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminLogin(username, password, remember = true) {
  const res = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (data.success && data.token) {
    if (remember) {
      localStorage.setItem('technova_admin_token', data.token);
      localStorage.setItem('technova_admin_user', JSON.stringify(data.admin));
    } else {
      sessionStorage.setItem('technova_admin_token', data.token);
      sessionStorage.setItem('technova_admin_user', JSON.stringify(data.admin));
    }
  }
  return data;
}

export async function adminLogout() {
  try {
    await fetch(`${API_BASE_URL}/admin/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
  } catch {
    // Ignore network error on logout
  }
  localStorage.removeItem('technova_admin_token');
  localStorage.removeItem('technova_admin_user');
  sessionStorage.removeItem('technova_admin_token');
  sessionStorage.removeItem('technova_admin_user');
}

export function getStoredAdmin() {
  const raw = localStorage.getItem('technova_admin_user') || sessionStorage.getItem('technova_admin_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem('technova_admin_token') || sessionStorage.getItem('technova_admin_token'));
}

export async function fetchAllScenarios() {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  if (res.status === 401) {
    adminLogout();
    throw new Error('Session expired. Please log in again.');
  }
  return await res.json();
}

export async function fetchScenarioById(id) {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios/${encodeURIComponent(id)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  if (res.status === 401) {
    adminLogout();
    throw new Error('Session expired. Please log in again.');
  }
  return await res.json();
}

export async function createScenario(scenarioData) {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  return await res.json();
}

export async function updateScenario(id, scenarioData) {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(scenarioData)
  });
  return await res.json();
}

export async function deleteScenario(id) {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  return await res.json();
}

export async function validateScenario(scenarioData, id = null) {
  const url = id 
    ? `${API_BASE_URL}/admin/scenarios/${encodeURIComponent(id)}/validate`
    : `${API_BASE_URL}/admin/scenarios/validate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(scenarioData)
  });
  return await res.json();
}

export async function publishScenarios() {
  const res = await fetch(`${API_BASE_URL}/admin/scenarios/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  return await res.json();
}

export async function fetchReports(limit = 50) {
  try {
    const res = await fetch(`${API_BASE_URL}/reports?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return await res.json();
  } catch (err) {
    console.warn('[adminApi] fetchReports error:', err.message);
    return { success: false, data: [] };
  }
}

export async function fetchReportById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(id)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return await res.json();
  } catch (err) {
    console.warn('[adminApi] fetchReportById error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchReportStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/stats`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return await res.json();
  } catch (err) {
    console.warn('[adminApi] fetchReportStats error:', err.message);
    return { success: false, stats: null };
  }
}

export async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/leaderboard`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return await res.json();
  } catch (err) {
    console.warn('[adminApi] fetchLeaderboard error:', err.message);
    return { success: false, data: [] };
  }
}

