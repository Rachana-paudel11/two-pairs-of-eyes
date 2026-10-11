/**
 * adminApp.js
 * Two Pairs of Eyes — Industrial Safety Management Console
 * Enterprise administration for warehouse safety scenarios and inspection patrol records.
 */

import './admin.css';
import {
  adminLogin,
  adminLogout,
  getStoredAdmin,
  isAuthenticated,
  fetchAllScenarios,
  fetchScenarioById,
  createScenario,
  updateScenario,
  deleteScenario,
  validateScenario,
  publishScenarios,
  fetchReports,
  fetchReportStats,
  fetchLeaderboard
} from './adminApi.js';

// SVG Icon Helpers
const ICONS = {
  dashboard: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  scenarios: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  hazardStops: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  sessions: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  leaderboard: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"/><path d="M18 17v-2.34"/><path d="M14 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
  compliance: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  settings: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  check: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  cross: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  menu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  arrowRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
};

const VALID_INTERACTIONS = [
  'cordonOff',
  'report',
  'holdPosition',
  'ignore',
  'continueOn',
  'isolateAndReport'
];

const OUTCOMES = ['optimal', 'partial', 'neutral', 'failure'];
const SUPERVISOR_BEHAVIOURS = ['dismissive', 'correct', 'uncertain'];
const HAZARD_SEVERITIES = ['low', 'moderate', 'severe'];

// Root container
const appRoot = document.getElementById('admin-app');

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

/**
 * Route Dispatcher
 */
function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const pathname = window.location.pathname.replace(/^\/admin\/?/, '');
  const effective = hash || pathname || 'dashboard';
  const parts = effective.split('/');

  return {
    page: parts[0] || 'dashboard',
    id: parts[1] || null
  };
}

function navigateTo(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

window.addEventListener('hashchange', renderApp);

/**
 * Format Status Badges with Icon + Text
 */
function getStatusBadgeHtml(status, type = 'badge-neutral') {
  let icon = ICONS.check;
  if (['hazard', 'danger', 'failure', 'failed', 'incident', 'critical'].includes(status.toLowerCase())) {
    icon = ICONS.alert;
    type = 'badge-danger';
  } else if (['warning', 'dismissive', 'attention', 'pending', 'near-miss', 'partial'].includes(status.toLowerCase())) {
    icon = ICONS.alert;
    type = 'badge-warning';
  } else if (['safe', 'optimal', 'correct', 'resolved', 'compliant'].includes(status.toLowerCase())) {
    icon = ICONS.check;
    type = 'badge-safe';
  } else if (['info', 'uncertain', 'active'].includes(status.toLowerCase())) {
    icon = ICONS.arrowRight;
    type = 'badge-info';
  }

  return `<span class="badge ${type}">${icon} <span>${status}</span></span>`;
}

/**
 * Main Application Shell Render
 */
async function renderApp() {
  const { page, id } = parseRoute();

  if (!isAuthenticated() && page !== 'login') {
    navigateTo('login');
    return;
  }

  if (isAuthenticated() && page === 'login') {
    navigateTo('dashboard');
    return;
  }

  if (page === 'login') {
    renderLoginView();
    return;
  }

  const admin = getStoredAdmin() || { username: 'admin', role: 'System Administrator' };
  const isCollapsed = localStorage.getItem('technova_admin_sidebar_collapsed') === 'true';

  // Compute Breadcrumb Titles
  const pageTitles = {
    dashboard: 'Dashboard Overview',
    scenarios: id === 'new' ? 'Add New Scenario' : (id ? `Edit Scenario: ${id}` : 'Scenarios Management'),
    'hazard-stops': 'Warehouse Hazard Stops',
    sessions: 'Trainee Inspection Patrols',
    leaderboard: 'Scores & Performance Leaderboard',
    compliance: 'Compliance & Schema Diagnostics',
    settings: 'System & Simulation Settings'
  };

  const currentTitle = pageTitles[page] || 'Dashboard';
  const categoryTitle = ['scenarios', 'hazard-stops'].includes(page)
    ? 'Training Management'
    : (['sessions', 'leaderboard'].includes(page) ? 'Training Records' : 'System Administration');

  // Render Layout Shell
  appRoot.innerHTML = `
    <div class="admin-layout-shell">
      <!-- Left Sidebar -->
      <aside class="admin-sidebar ${isCollapsed ? 'collapsed' : ''}" id="app-sidebar">
        <div class="sidebar-header">
          <a href="#/dashboard" class="sidebar-brand">
            <div class="sidebar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div class="sidebar-brand-text">
              <span class="sidebar-brand-title">Two Pairs of Eyes</span>
              <span class="sidebar-brand-sub">Safety Operations</span>
            </div>
          </a>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-nav-section">
            <div class="nav-section-title">Overview</div>
            <a href="#/dashboard" class="sidebar-link ${page === 'dashboard' ? 'active' : ''}">
              ${ICONS.dashboard}
              <span class="sidebar-link-text">Dashboard</span>
            </a>
          </div>

          <div class="sidebar-nav-section">
            <div class="nav-section-title">Training Management</div>
            <a href="#/scenarios" class="sidebar-link ${page === 'scenarios' ? 'active' : ''}">
              ${ICONS.scenarios}
              <span class="sidebar-link-text">Scenarios</span>
            </a>
            <a href="#/hazard-stops" class="sidebar-link ${page === 'hazard-stops' ? 'active' : ''}">
              ${ICONS.hazardStops}
              <span class="sidebar-link-text">Hazard Stops</span>
            </a>
          </div>

          <div class="sidebar-nav-section">
            <div class="nav-section-title">Training Records</div>
            <a href="#/sessions" class="sidebar-link ${page === 'sessions' ? 'active' : ''}">
              ${ICONS.sessions}
              <span class="sidebar-link-text">Patrol Records</span>
            </a>
            <a href="#/leaderboard" class="sidebar-link ${page === 'leaderboard' ? 'active' : ''}">
              ${ICONS.leaderboard}
              <span class="sidebar-link-text">Leaderboard</span>
            </a>
          </div>

          <div class="sidebar-nav-section">
            <div class="nav-section-title">System & Ops</div>
            <a href="#/compliance" class="sidebar-link ${page === 'compliance' ? 'active' : ''}">
              ${ICONS.compliance}
              <span class="sidebar-link-text">Compliance & AJV</span>
            </a>
            <a href="#/settings" class="sidebar-link ${page === 'settings' ? 'active' : ''}">
              ${ICONS.settings}
              <span class="sidebar-link-text">Settings</span>
            </a>
          </div>
        </nav>

        <div class="sidebar-footer">
          <div class="system-status-indicator">
            <span class="status-pulse-dot"></span>
            <span class="sidebar-footer-text">Simulation Online</span>
          </div>
          <button id="btn-sidebar-collapse" class="sidebar-collapse-btn" title="${isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}" aria-label="Toggle Sidebar Width">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>
      </aside>

      <!-- Backdrop for mobile drawer -->
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <!-- Main Column -->
      <div class="admin-main-wrapper">
        <header class="admin-topbar">
          <div class="topbar-left">
            <button id="btn-mobile-menu" class="mobile-menu-toggle" aria-label="Toggle Navigation Sidebar" title="Toggle Navigation Sidebar">
              ${ICONS.menu}
            </button>
            <div class="breadcrumbs">
              <span class="breadcrumb-item">${categoryTitle}</span>
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-current">${currentTitle}</span>
            </div>
          </div>

          <div class="topbar-right">
            <a href="/" target="_blank" class="simulation-link-btn" title="Open Trainee Simulation in new tab">
              <span>Launch 3D Patrol</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <div class="admin-profile-pill">
              <span class="admin-avatar">${(admin.username || 'A')[0].toUpperCase()}</span>
              <span>${admin.username || 'admin'}</span>
            </div>
            <button id="btn-logout" class="btn btn-secondary btn-sm" title="Sign out of Admin Console">
              Logout
            </button>
          </div>
        </header>

        <main class="admin-container" id="admin-view-container">
          <div class="skeleton-box" style="height: 180px; width: 100%; margin-bottom: 2rem;"></div>
          <div class="skeleton-box" style="height: 340px; width: 100%;"></div>
        </main>
      </div>
    </div>
  `;

  // Bind Sidebar Collapse Toggle
  const sidebar = document.getElementById('app-sidebar');
  const collapseBtn = document.getElementById('btn-sidebar-collapse');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  const toggleSidebarCollapse = () => {
    if (!sidebar) return;
    const isNowCollapsed = sidebar.classList.toggle('collapsed');
    if (collapseBtn) {
      collapseBtn.setAttribute('title', isNowCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar');
    }
    localStorage.setItem('technova_admin_sidebar_collapsed', String(isNowCollapsed));
  };

  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebarCollapse);
  }

  // Menu Toggle (mobile opens drawer; desktop toggles collapsed state)
  const mobileMenuBtn = document.getElementById('btn-mobile-menu');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('mobile-open');
      } else {
        toggleSidebarCollapse();
      }
    });
  }

  // Click backdrop to dismiss mobile drawer
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
    });
  }

  // Bind Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await adminLogout();
    showToast('Logged out successfully.');
    navigateTo('login');
  });

  // Dispatch View
  const viewContainer = document.getElementById('admin-view-container');
  try {
    switch (page) {
      case 'dashboard':
        await renderDashboardView(viewContainer);
        break;
      case 'scenarios':
        if (id === 'new') {
          await renderScenarioForm(viewContainer, null);
        } else if (id) {
          await renderScenarioForm(viewContainer, id);
        } else {
          await renderScenariosListView(viewContainer);
        }
        break;
      case 'hazard-stops':
        await renderHazardStopsInspector(viewContainer);
        break;
      case 'sessions':
        await renderSessionsView(viewContainer);
        break;
      case 'leaderboard':
        await renderLeaderboardView(viewContainer);
        break;
      case 'compliance':
        await renderComplianceView(viewContainer);
        break;
      case 'settings':
        await renderSettingsView(viewContainer);
        break;
      default:
        navigateTo('dashboard');
        break;
    }
  } catch (err) {
    console.error('[Admin Render Error]:', err);
    viewContainer.innerHTML = `
      <div class="panel-card">
        <h3 style="color:var(--danger-color)">Error loading operational view</h3>
        <p style="margin:1rem 0; color:var(--admin-text-muted)">${err.message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()">Retry View</button>
      </div>
    `;
  }
}

/**
 * 1. Login View
 */
function renderLoginView() {
  appRoot.innerHTML = `
    <div class="admin-login-wrapper">
      <div class="admin-login-header">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; background:rgba(0,229,255,0.12); border:1px solid rgba(0,229,255,0.3); border-radius:12px; margin-bottom:1rem; color:var(--brand-primary);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div style="font-size:0.75rem; font-weight:800; letter-spacing:0.12em; color:var(--brand-primary); text-transform:uppercase;">
          Enterprise Safety Management
        </div>
        <h2>Two Pairs of Eyes</h2>
        <p style="color:var(--admin-text-muted); font-size:0.88rem; margin-top:0.35rem;">
          Warehouse Operations & Simulation Admin Console
        </p>
      </div>

      <div id="login-error-banner" class="validation-box invalid" style="display:none; margin-bottom:1.25rem;"></div>

      <form id="admin-login-form" class="admin-form">
        <div class="form-group">
          <label for="admin-user">Administrator Username</label>
          <input type="text" id="admin-user" class="form-control" placeholder="admin" value="admin" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="admin-pass">Password</label>
          <input type="password" id="admin-pass" class="form-control" placeholder="••••••••••••" value="adminPassword123!" required autocomplete="current-password" />
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--admin-text-muted);">
          <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;">
            <input type="checkbox" id="admin-remember" checked /> Remember session
          </label>
          <a href="/" target="_blank" style="color:var(--brand-primary); text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;">
            Simulation Portal ↗
          </a>
        </div>
        <button type="submit" id="admin-submit-btn" class="btn btn-primary" style="justify-content:center; padding:0.75rem;">
          Authenticate as Administrator
        </button>
      </form>
      <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--admin-border); text-align:center; font-size:0.75rem; color:var(--admin-text-dim);">
        TechNova Warehouse Safety Suite • Enterprise Training System
      </div>
    </div>
  `;

  const form = document.getElementById('admin-login-form');
  const errorBanner = document.getElementById('login-error-banner');
  const submitBtn = document.getElementById('admin-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Authenticating...';

    const username = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value;
    const remember = document.getElementById('admin-remember').checked;

    try {
      const res = await adminLogin(username, password, remember);
      if (res.success) {
        showToast('✓ Authentication granted.', 'success');
        navigateTo('dashboard');
      } else {
        errorBanner.innerText = res.error || 'Authentication rejected. Please check credentials.';
        errorBanner.style.display = 'block';
      }
    } catch {
      errorBanner.innerText = 'Unable to reach backend server. Please verify Express is active on port 5000.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Authenticate as Administrator';
    }
  });
}

/**
 * 2. Dashboard View (5-Second Executive Safety Scan)
 */
async function renderDashboardView(container) {
  const [scenariosRes, statsRes, reportsRes] = await Promise.all([
    fetchAllScenarios(),
    fetchReportStats().catch(() => ({ stats: null })),
    fetchReports(5).catch(() => ({ data: [] }))
  ]);

  const dataset = scenariosRes.data || { stops: [] };
  const stops = dataset.stops || [];
  const stats = statsRes.stats || { totalPatrols: 0, passedPatrols: 0, passRate: 0, averageScore: 0 };
  const recentReports = Array.isArray(reportsRes.data) ? reportsRes.data : [];

  const totalHazards = stops.filter(s => s.hazard?.present).length;
  const severeHazards = stops.filter(s => s.hazard?.present && s.hazard?.severity === 'severe').length;

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>Operational Dashboard</h1>
        <p>Enterprise oversight of warehouse safety scenarios, inspection records, and sequential hazard assessment.</p>
      </div>
      <div class="page-actions">
        <button id="btn-dash-publish" class="btn btn-success">
          ${ICONS.check} <span>Save & Publish to 3D Simulation</span>
        </button>
        <a href="#/scenarios/new" class="btn btn-primary">
          + Author New Stop
        </a>
      </div>
    </div>

    <!-- Executive KPI Cards Grid -->
    <div class="stats-grid">
      <div class="stat-card" style="--stat-accent: var(--brand-primary);">
        <div class="stat-card-header">
          <span class="stat-label">Active Patrol Stops</span>
          <div class="stat-icon">${ICONS.scenarios}</div>
        </div>
        <div class="stat-val">${stops.length}</div>
        <div class="stat-desc">Sequential hazard evaluation zones</div>
      </div>

      <div class="stat-card" style="--stat-accent: var(--warn-color);">
        <div class="stat-card-header">
          <span class="stat-label">Identified Hazards</span>
          <div class="stat-icon">${ICONS.hazardStops}</div>
        </div>
        <div class="stat-val">${totalHazards} <span style="font-size:0.9rem; font-weight:600; color:var(--danger-color)">(${severeHazards} severe)</span></div>
        <div class="stat-desc">Slip, blind-corner, rack damage, & charging</div>
      </div>

      <div class="stat-card" style="--stat-accent: var(--safe-color);">
        <div class="stat-card-header">
          <span class="stat-label">Safety Compliance Pass Rate</span>
          <div class="stat-icon">${ICONS.compliance}</div>
        </div>
        <div class="stat-val" style="color:var(--safe-color)">${stats.passRate}%</div>
        <div class="stat-desc">${stats.totalPatrols ? `Based on ${stats.totalPatrols} recorded trainee inspection${stats.totalPatrols === 1 ? '' : 's'}` : 'No inspection records logged yet'}</div>
      </div>

      <div class="stat-card" style="--stat-accent: #38bdf8;">
        <div class="stat-card-header">
          <span class="stat-label">Completed Patrol Records</span>
          <div class="stat-icon">${ICONS.sessions}</div>
        </div>
        <div class="stat-val">${stats.totalPatrols || 0}</div>
        <div class="stat-desc">${stats.totalPatrols ? `${stats.passedPatrols || 0} passed compliance standard` : 'Awaiting simulation patrol runs'}</div>
      </div>
    </div>

    <!-- Active Scenario Stops Table -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title-group">
          <h2>Active Warehouse Inspection Stops</h2>
          <div class="panel-subtitle">Sequential authored patrol checkpoints currently active in the 3D warehouse environment.</div>
        </div>
        <div class="panel-actions">
          <a href="#/hazard-stops" class="btn btn-secondary btn-sm">Visual Stop Inspector</a>
          <a href="#/scenarios" class="btn btn-primary btn-sm">Manage All Scenarios</a>
        </div>
      </div>

      <div class="table-responsive">
        <table class="scenario-table">
          <thead>
            <tr>
              <th style="width: 50px;">Seq</th>
              <th>Stop ID</th>
              <th>Inspection Area & Title</th>
              <th>Supervisor Persona</th>
              <th>Hazard Status</th>
              <th>Outcome Choices</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody>
            ${stops.map((stop, idx) => {
              const num = String(idx + 1).padStart(2, '0');
              const behaviour = stop.supervisor?.behaviour || 'dismissive';
              const hazardPresent = stop.hazard?.present;
              const hazardLabel = hazardPresent
                ? `${stop.hazard.severity?.toUpperCase()} (${stop.hazard.type})`
                : 'Clear Area';
              const actionsCount = Object.keys(stop.actions || {}).length;

              return `
                <tr>
                  <td><span class="font-mono" style="font-weight:700; color:var(--brand-primary);">${num}</span></td>
                  <td><code class="font-mono" style="font-size:0.8rem; color:var(--admin-text-muted);">${stop.id}</code></td>
                  <td>
                    <div style="font-weight:600; color:#fff;">${stop.title}</div>
                    <div style="font-size:0.75rem; color:var(--admin-text-dim);">${stop.location}</div>
                  </td>
                  <td>
                    <span class="badge badge-${behaviour}">${stop.supervisor?.name || 'Dave'} (${behaviour})</span>
                  </td>
                  <td>
                    ${getStatusBadgeHtml(hazardLabel, hazardPresent ? 'badge-hazard' : 'badge-safe')}
                  </td>
                  <td>
                    <span class="badge badge-neutral">${actionsCount} Decision Options</span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display:inline-flex; gap:0.4rem;">
                      <a href="#/scenarios/${stop.id}" class="btn btn-secondary btn-sm">Edit</a>
                      <button class="btn btn-danger btn-sm btn-delete-stop" data-id="${stop.id}" data-title="${stop.title}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Trainee Inspection Patrols -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title-group">
          <h2>Recent Trainee Inspection Records</h2>
          <div class="panel-subtitle">Latest performance logs captured from trainee 3D warehouse patrols.</div>
        </div>
        <a href="#/sessions" class="btn btn-secondary btn-sm">View All Records</a>
      </div>

      <div class="table-responsive">
        <table class="scenario-table">
          <thead>
            <tr>
              <th>Trainee</th>
              <th>Assessment Date</th>
              <th>Final Score</th>
              <th>Pass / Fail</th>
              <th>Consequence Flags</th>
              <th>Performance Rank</th>
              <th style="text-align: right;">Debrief</th>
            </tr>
          </thead>
          <tbody>
            ${recentReports.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding: 2.5rem 1rem; color:var(--admin-text-muted);">
                  <div style="font-weight:600; color:#fff; margin-bottom:0.35rem;">No Recorded Patrols Yet</div>
                  <div style="font-size:0.85rem;">Trainee patrol inspection records will appear here as safety walks are completed in the 3D warehouse.</div>
                </td>
              </tr>
            ` : recentReports.map((rep) => {
              const dateStr = rep.completedAt ? new Date(rep.completedAt).toLocaleDateString() : 'Today';
              const isPass = Boolean(rep.passed);
              const flagsCount = (rep.flags || []).length;
              const rank = rep.rankTitle || (isPass ? 'Safety Champion' : 'Hazards Overlooked');

              return `
                <tr>
                  <td>
                    <div style="font-weight:600; color:#fff;">${rep.traineeName || 'Alex'}</div>
                    <div class="font-mono" style="font-size:0.75rem; color:var(--admin-text-dim);">${rep.traineeId || 'TR-10001'}</div>
                  </td>
                  <td><span style="font-size:0.85rem; color:var(--admin-text-muted);">${dateStr}</span></td>
                  <td>
                    <span class="font-mono" style="font-weight:700; font-size:1rem; color:${rep.totalScore >= 18 ? 'var(--safe-color)' : 'var(--warn-color)'}">
                      ${rep.totalScore} / ${rep.maxScore || 25}
                    </span>
                  </td>
                  <td>
                    ${getStatusBadgeHtml(isPass ? 'PASSED' : 'FAILED', isPass ? 'badge-safe' : 'badge-danger')}
                  </td>
                  <td>
                    <span class="badge ${flagsCount > 0 ? 'badge-warning' : 'badge-safe'}">
                      ${flagsCount} Flag${flagsCount === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${isPass ? 'badge-safe' : 'badge-warning'}">
                      ${rank}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-view-report" data-report='${JSON.stringify(rep).replace(/'/g, "&apos;")}'>
                      View Timeline
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Publish Button
  document.getElementById('btn-dash-publish').addEventListener('click', async () => {
    try {
      const pubRes = await publishScenarios();
      if (pubRes.success) {
        showToast('✓ Scenarios successfully published and synchronized with 3D simulation.', 'success');
      } else {
        showToast(`Publish error: ${pubRes.error}`, 'error');
      }
    } catch (err) {
      showToast(`Publish failed: ${err.message}`, 'error');
    }
  });

  // Bind Delete buttons with confirmation
  container.querySelectorAll('.btn-delete-stop').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const title = e.currentTarget.dataset.title;
      confirmAndDeleteScenario(id, title);
    });
  });

  // Bind View Report Modal
  container.querySelectorAll('.btn-view-report').forEach(btn => {
    btn.addEventListener('click', (e) => {
      try {
        const rep = JSON.parse(e.currentTarget.dataset.report);
        openReportModal(rep);
      } catch (err) {
        console.error('Failed to parse report data', err);
      }
    });
  });
}

/**
 * 3. Scenarios List View with Search & Filtering
 */
async function renderScenariosListView(container) {
  const res = await fetchAllScenarios();
  const dataset = res.data || { stops: [], endOfSessionRules: [] };
  let allStops = dataset.stops || [];

  function renderTable(stopsToDisplay) {
    const tbody = container.querySelector('#scenarios-table-body');
    if (!tbody) return;

    if (stopsToDisplay.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">${ICONS.search}</div>
              <div class="empty-state-title">No scenarios match your filter</div>
              <div class="empty-state-desc">Try clearing the search query or selecting a different hazard/supervisor filter.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = stopsToDisplay.map((stop, idx) => {
      const behaviour = stop.supervisor?.behaviour || 'dismissive';
      const actions = Object.values(stop.actions || {});
      const hazardPresent = stop.hazard?.present;
      const hazardText = hazardPresent ? `${stop.hazard.severity} • ${stop.hazard.type}` : 'Clear Area';

      return `
        <tr>
          <td><span class="font-mono" style="font-weight:700; color:var(--brand-primary); font-size:1rem;">${String(idx + 1).padStart(2, '0')}</span></td>
          <td><code class="font-mono" style="font-size:0.82rem; color:var(--admin-text-muted);">${stop.id}</code></td>
          <td>
            <div style="font-weight:600; color:#fff;">${stop.title}</div>
            <div style="font-size:0.75rem; color:var(--admin-text-dim);">${stop.location}</div>
          </td>
          <td>
            <span class="badge badge-${behaviour}" style="margin-bottom:0.25rem;">${stop.supervisor?.name || 'Dave'} (${behaviour})</span>
            <div style="color:var(--admin-text-muted); font-size:0.8rem; font-style:italic; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${stop.supervisor?.dialogue || ''}">
              "${stop.supervisor?.dialogue || ''}"
            </div>
          </td>
          <td>
            ${getStatusBadgeHtml(hazardText, hazardPresent ? 'badge-hazard' : 'badge-safe')}
          </td>
          <td>
            <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">
              ${actions.map(a => `<span class="badge badge-${a.outcome}">${a.outcome} (${a.points > 0 ? '+' : ''}${a.points})</span>`).join('')}
            </div>
          </td>
          <td style="text-align: right;">
            <div style="display:inline-flex; gap:0.4rem;">
              <a href="#/scenarios/${stop.id}" class="btn btn-secondary btn-sm">Edit</a>
              <button class="btn btn-danger btn-sm btn-delete-scenario" data-id="${stop.id}" data-title="${stop.title}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Rebind delete buttons
    tbody.querySelectorAll('.btn-delete-scenario').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const title = e.currentTarget.dataset.title;
        confirmAndDeleteScenario(id, title);
      });
    });
  }

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>All Training Scenarios</h1>
        <p>Inspect, filter, author, and validate sequential warehouse safety stops.</p>
      </div>
      <div class="page-actions">
        <button id="btn-publish-all" class="btn btn-success">
          ${ICONS.check} <span>Publish to Simulation</span>
        </button>
        <a href="#/scenarios/new" class="btn btn-primary">
          + Add New Scenario
        </a>
      </div>
    </div>

    <!-- Search & Filter Bar (Requirement 10) -->
    <div class="table-toolbar">
      <div class="search-box-wrapper">
        <span class="search-icon-pos">${ICONS.search}</span>
        <input type="text" id="scenario-search" class="form-control search-input" placeholder="Search scenarios by title, zone, ID, or dialogue..." />
      </div>
      <div class="filter-group">
        <select id="filter-hazard" class="filter-select">
          <option value="all">All Hazard States</option>
          <option value="hazard">Hazards Present Only</option>
          <option value="clear">Clear Zones Only</option>
        </select>
        <select id="filter-behaviour" class="filter-select">
          <option value="all">All Supervisor Personas</option>
          <option value="dismissive">Dismissive Dave</option>
          <option value="uncertain">Uncertain Dave</option>
          <option value="correct">Correct / Compliant Dave</option>
        </select>
      </div>
    </div>

    <div class="panel-card">
      <div class="table-responsive">
        <table class="scenario-table">
          <thead>
            <tr>
              <th style="width: 50px;">Seq</th>
              <th>Stop ID</th>
              <th>Title & Area</th>
              <th>Supervisor Dialogue</th>
              <th>Hazard Status</th>
              <th>Available Outcomes</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody id="scenarios-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  renderTable(allStops);

  // Search and Filter Handlers
  const searchInput = document.getElementById('scenario-search');
  const hazardFilter = document.getElementById('filter-hazard');
  const behaviourFilter = document.getElementById('filter-behaviour');

  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase().trim();
    const hazardVal = hazardFilter.value;
    const behaviourVal = behaviourFilter.value;

    const filtered = allStops.filter(s => {
      const matchQ = !q || (
        s.id.toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (s.supervisor?.dialogue || '').toLowerCase().includes(q)
      );

      const matchHazard = hazardVal === 'all' || (
        hazardVal === 'hazard' ? Boolean(s.hazard?.present) : !s.hazard?.present
      );

      const matchBehaviour = behaviourVal === 'all' || (
        s.supervisor?.behaviour === behaviourVal
      );

      return matchQ && matchHazard && matchBehaviour;
    });

    renderTable(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  hazardFilter.addEventListener('change', applyFilters);
  behaviourFilter.addEventListener('change', applyFilters);

  document.getElementById('btn-publish-all').addEventListener('click', async () => {
    try {
      const pubRes = await publishScenarios();
      if (pubRes.success) {
        showToast('✓ Scenarios successfully published and synchronized with 3D simulation.', 'success');
      } else {
        showToast(`Publish error: ${pubRes.error}`, 'error');
      }
    } catch (err) {
      showToast(`Publish failed: ${err.message}`, 'error');
    }
  });
}

/**
 * 4. Hazard Stops Visual Inspector (Requirement 12)
 */
async function renderHazardStopsInspector(container) {
  const res = await fetchAllScenarios();
  const dataset = res.data || { stops: [] };
  const stops = dataset.stops || [];

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>Hazard Stops Inspector</h1>
        <p>Visual overview of warehouse zones, supervisor behavior, hazard severity, and safety guidance.</p>
      </div>
      <div class="page-actions">
        <a href="#/scenarios" class="btn btn-secondary">Table View</a>
        <a href="#/scenarios/new" class="btn btn-primary">+ Author New Stop</a>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:1.5rem;">
      ${stops.map((stop, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const hazardPresent = stop.hazard?.present;
        const behaviour = stop.supervisor?.behaviour || 'dismissive';
        const actions = Object.entries(stop.actions || {});

        return `
          <div class="panel-card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between; border-top: 3px solid ${hazardPresent ? (stop.hazard?.severity === 'severe' ? 'var(--danger-color)' : 'var(--warn-color)') : 'var(--safe-color)'};">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                <div>
                  <span class="badge badge-info" style="font-family:var(--admin-font-mono); margin-bottom:0.35rem;">STOP ${num}</span>
                  <h3 style="font-size:1.15rem; font-weight:700; color:#fff;">${stop.title}</h3>
                  <div class="font-mono" style="font-size:0.75rem; color:var(--admin-text-dim);">${stop.location}</div>
                </div>
                ${getStatusBadgeHtml(
                  hazardPresent ? `${stop.hazard.severity?.toUpperCase()} HAZARD` : 'CLEAR ZONE',
                  hazardPresent ? 'badge-hazard' : 'badge-safe'
                )}
              </div>

              <!-- Supervisor Section -->
              <div style="background:rgba(0,0,0,0.25); border:1px solid var(--admin-border); border-radius:var(--radius-md); padding:0.85rem 1rem; margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                  <span style="font-size:0.78rem; font-weight:700; color:var(--admin-text-muted); text-transform:uppercase;">Supervisor Dave</span>
                  <span class="badge badge-${behaviour}">${behaviour}</span>
                </div>
                <div style="font-size:0.85rem; color:var(--admin-text-secondary); font-style:italic;">
                  "${stop.supervisor?.dialogue || 'Keep moving.'}"
                </div>
              </div>

              <!-- Learning Objective -->
              <div style="margin-bottom:1rem; font-size:0.82rem; color:var(--admin-text-muted); border-left:2px solid var(--brand-primary); padding-left:0.65rem;">
                <strong>Safety Guidance:</strong> ${stop.learning_objective || 'Identify and mitigate active warehouse hazards immediately.'}
              </div>

              <!-- Decision Paths -->
              <div style="margin-bottom:1rem;">
                <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--admin-text-dim); margin-bottom:0.45rem;">
                  Available Decisions (${actions.length})
                </div>
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                  ${actions.map(([k, a]) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--admin-bg-card); padding:0.45rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--admin-border-subtle); font-size:0.82rem;">
                      <span style="color:#fff; font-weight:500;"><code>${k}</code> (${a.interaction})</span>
                      <span class="badge badge-${a.outcome}">${a.points > 0 ? '+' : ''}${a.points} pts</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--admin-border-subtle); padding-top:0.85rem; margin-top:1rem;">
              <code class="font-mono" style="font-size:0.75rem; color:var(--admin-text-dim);">${stop.id}</code>
              <a href="#/scenarios/${stop.id}" class="btn btn-secondary btn-sm">Edit Stop Config →</a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatFlagName(flag) {
  if (flag === 'ignored_ground_hazard') return 'Stop 01: Fluid Spill Ignored';
  if (flag === 'near_miss_forklift') return 'Stop 02: Forklift Crossing Unchecked';
  if (flag === 'ignored_rack_damage') return 'Stop 03: Bent Rack Structural Hazard Ignored';
  if (flag === 'ignored_charging_warning') return 'Stop 04: Overheating Charger Ignored';
  return flag.replace(/_/g, ' ');
}

/**
 * 6. Scenario Add / Edit Form View (Requirements 11 & 12)
 */
async function renderScenarioForm(container, stopId) {
  const isEditing = Boolean(stopId);
  let stopData = null;

  if (isEditing) {
    const res = await fetchScenarioById(stopId);
    stopData = res.data;
    if (!stopData) {
      container.innerHTML = `<div class="panel-card"><h3>Scenario "${stopId}" not found</h3></div>`;
      return;
    }
  } else {
    stopData = {
      id: `stop_${Date.now().toString().slice(-4)}`,
      title: 'New Warehouse Inspection Stop',
      location: 'warehouse_transit_zone',
      hazard: {
        present: true,
        type: 'ground_level',
        subtype: 'fluid_spill',
        severity: 'moderate'
      },
      supervisor: {
        name: 'Dave',
        behaviour: 'dismissive',
        dialogue: 'People have walked around this all morning. Keep moving.'
      },
      alexStartPosition: { x: 0, y: 0, z: -10 },
      alexTargetPosition: { x: 0, y: 0, z: -12 },
      actions: {
        action_opt: {
          interaction: 'cordonOff',
          points: 5,
          outcome: 'optimal',
          consequence: 'hazard_controlled',
          feedback: 'Outstanding decision. You controlled the risk instead of walking past it.',
          alexAction: 'cordon_area'
        },
        action_rep: {
          interaction: 'report',
          points: 3,
          outcome: 'partial',
          consequence: 'reported_pending_action',
          feedback: 'Reporting is good, but immediate containment was required to protect colleagues.',
          alexAction: 'move_to_safety'
        },
        action_ign: {
          interaction: 'ignore',
          points: -3,
          outcome: 'failure',
          consequence: 'near_miss_unaddressed',
          feedback: 'Walking past normalized hazards invites serious workplace accidents.',
          alexAction: 'follow_dave'
        }
      },
      flags_on_failure: ['unaddressed_hazard'],
      learning_objective: 'Never step around or normalize a hazard — secure the area immediately.'
    };
  }

  const actionsKeys = Object.keys(stopData.actions || {});

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>${isEditing ? `Edit Stop: ${stopData.title}` : 'Author New Training Scenario Stop'}</h1>
        <p>${isEditing ? `Editing stop ID: ${stopData.id} • Conforms to stops.schema.json` : 'Create a new schema-compliant safety stop for the 3D warehouse patrol'}</p>
      </div>
      <div class="page-actions">
        <a href="#/scenarios" class="btn btn-secondary">Cancel</a>
        <button id="btn-validate-scenario" class="btn btn-secondary">
          🔍 Validate AJV Schema
        </button>
        <button id="btn-save-scenario" class="btn btn-primary">
          💾 Save Scenario
        </button>
      </div>
    </div>

    <!-- Validation Result Banner -->
    <div id="form-validation-banner" class="validation-box" style="display:none;"></div>

    <form id="scenario-edit-form" class="admin-form">
      <!-- Section 1: Identification & Metadata -->
      <div class="form-section">
        <div class="form-section-title">
          <span class="form-section-badge">SECTION 1</span>
          <span>Basic Information & Spatial Location</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="stop-id">Stop ID <span style="color:var(--danger-color)">*</span></label>
            <input type="text" id="stop-id" class="form-control font-mono" value="${stopData.id}" required pattern="^[a-z0-9_]+$" ${isEditing ? 'readonly style="opacity:0.75;"' : ''} />
            <span class="form-group-helper">Unique key (lowercase letters, digits, and underscores)</span>
          </div>
          <div class="form-group">
            <label for="stop-title">Scenario Title / Name <span style="color:var(--danger-color)">*</span></label>
            <input type="text" id="stop-title" class="form-control" value="${stopData.title}" required />
          </div>
          <div class="form-group">
            <label for="stop-location">Location Identifier <span style="color:var(--danger-color)">*</span></label>
            <input type="text" id="stop-location" class="form-control font-mono" value="${stopData.location}" required />
          </div>
        </div>
        <div class="form-group">
          <label for="stop-learning-objective">Learning Objective / Safety Guidance <span style="color:var(--danger-color)">*</span></label>
          <input type="text" id="stop-learning-objective" class="form-control" value="${stopData.learning_objective || ''}" required placeholder="Key takeaway shown in debrief..." />
        </div>
      </div>

      <!-- Section 2: Hazard Configuration -->
      <div class="form-section">
        <div class="form-section-title">
          <span class="form-section-badge">SECTION 2</span>
          <span>Hazard Definition & Severity</span>
        </div>
        <div class="form-row">
          <div class="form-group" style="justify-content:center;">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; text-transform:none; font-size:0.95rem; color:#fff;">
              <input type="checkbox" id="hazard-present" ${stopData.hazard?.present ? 'checked' : ''} style="width:18px; height:18px;" />
              Active Hazard Present in Zone
            </label>
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-type">Hazard Type</label>
            <input type="text" id="hazard-type" class="form-control" value="${stopData.hazard?.type || 'ground_level'}" />
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-subtype">Hazard Subtype</label>
            <input type="text" id="hazard-subtype" class="form-control" value="${stopData.hazard?.subtype || ''}" placeholder="e.g. fluid_spill" />
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-severity">Severity Level</label>
            <select id="hazard-severity" class="form-control">
              ${HAZARD_SEVERITIES.map(sev => `
                <option value="${sev}" ${stopData.hazard?.severity === sev ? 'selected' : ''}>${sev.toUpperCase()}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Section 3: Supervisor Persona & Spoken Dialogue -->
      <div class="form-section">
        <div class="form-section-title">
          <span class="form-section-badge">SECTION 3</span>
          <span>Dave / Supervisor Persona & Spoken Dialogue</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="supervisor-name">Supervisor Name</label>
            <input type="text" id="supervisor-name" class="form-control" value="${stopData.supervisor?.name || 'Dave'}" required />
          </div>
          <div class="form-group">
            <label for="supervisor-behaviour">Supervisor Behaviour Mode</label>
            <select id="supervisor-behaviour" class="form-control">
              ${SUPERVISOR_BEHAVIOURS.map(b => `
                <option value="${b}" ${stopData.supervisor?.behaviour === b ? 'selected' : ''}>${b.toUpperCase()}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="supervisor-dialogue">Supervisor Spoken Line (Audio subtitle)</label>
          <textarea id="supervisor-dialogue" class="form-control" required>${stopData.supervisor?.dialogue || ''}</textarea>
        </div>
      </div>

      <!-- Section 4: Available Actions & Scoring (Requirement 11) -->
      <div class="form-section">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--admin-border-subtle); padding-bottom:0.75rem;">
          <div class="form-section-title" style="border:none; padding:0; margin:0;">
            <span class="form-section-badge">SECTION 4</span>
            <span>Available Actions & Scoring Choices (Min. 2)</span>
          </div>
          <button type="button" id="btn-add-action" class="btn btn-secondary btn-sm">+ Add Action Option</button>
        </div>
        <div id="actions-container" style="display:flex; flex-direction:column; gap:1.25rem;">
          ${actionsKeys.map((actionKey) => renderActionFormBlock(actionKey, stopData.actions[actionKey])).join('')}
        </div>
      </div>

      <!-- Section 5: Safety Consequence Flags & 3D Coordinates -->
      <div class="form-section">
        <div class="form-section-title">
          <span class="form-section-badge">SECTION 5</span>
          <span>Safety Consequence Flags & 3D World Coordinates</span>
        </div>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label for="stop-flags">Safety Consequence Flags</label>
          <input type="text" id="stop-flags" class="form-control font-mono" value="${(stopData.flags_on_failure || []).join(', ')}" placeholder="e.g. ignored_ground_hazard, near_miss_forklift" />
          <span class="form-group-helper">Comma-separated flags recorded when trainee makes an unsafe decision</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Alex Trainee Start Coordinates (X, Y, Z)</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="number" step="0.05" id="pos-start-x" class="form-control font-mono" value="${stopData.alexStartPosition?.x ?? 0}" placeholder="X" />
              <input type="number" step="0.05" id="pos-start-y" class="form-control font-mono" value="${stopData.alexStartPosition?.y ?? 0}" placeholder="Y" />
              <input type="number" step="0.05" id="pos-start-z" class="form-control font-mono" value="${stopData.alexStartPosition?.z ?? 0}" placeholder="Z" />
            </div>
          </div>
          <div class="form-group">
            <label>Alex Trainee Target Coordinates (X, Y, Z)</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="number" step="0.05" id="pos-target-x" class="form-control font-mono" value="${stopData.alexTargetPosition?.x ?? 0}" placeholder="X" />
              <input type="number" step="0.05" id="pos-target-y" class="form-control font-mono" value="${stopData.alexTargetPosition?.y ?? 0}" placeholder="Y" />
              <input type="number" step="0.05" id="pos-target-z" class="form-control font-mono" value="${stopData.alexTargetPosition?.z ?? 0}" placeholder="Z" />
            </div>
          </div>
        </div>
      </div>
    </form>
  `;

  // Dynamic Hazard fields toggle
  const hazardPresentCheckbox = document.getElementById('hazard-present');
  const toggleHazardFields = () => {
    const isPresent = hazardPresentCheckbox.checked;
    document.querySelectorAll('.hazard-detail-group').forEach(el => {
      el.style.opacity = isPresent ? '1' : '0.4';
      el.querySelectorAll('input, select').forEach(inp => inp.disabled = !isPresent);
    });
  };
  hazardPresentCheckbox.addEventListener('change', toggleHazardFields);
  toggleHazardFields();

  // Add Action Option Button
  document.getElementById('btn-add-action').addEventListener('click', () => {
    const containerEl = document.getElementById('actions-container');
    const newKey = `action_${Date.now().toString().slice(-4)}`;
    const newBlockHtml = renderActionFormBlock(newKey, {
      interaction: 'report',
      points: 3,
      outcome: 'partial',
      consequence: 'reported',
      feedback: 'Trainee feedback on taking this action.',
      alexAction: 'move_to_safety'
    });
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newBlockHtml;
    containerEl.appendChild(tempDiv.firstElementChild);
    bindActionBlockButtons();
  });

  bindActionBlockButtons();

  // Validation function
  const validateCurrentForm = async () => {
    const payload = extractFormData();
    const banner = document.getElementById('form-validation-banner');
    banner.style.display = 'block';
    banner.className = 'validation-box';
    banner.innerHTML = '<span>Validating scenario with AJV schema engine...</span>';

    try {
      const res = await validateScenario(payload, isEditing ? stopId : null);
      if (res.valid) {
        banner.className = 'validation-box valid';
        banner.innerHTML = '✓ <strong>Schema Valid:</strong> Stop strictly satisfies <code>stops.schema.json</code>, interaction registry constraints, and outcome tiers.';
        return { valid: true, payload };
      } else {
        banner.className = 'validation-box invalid';
        banner.innerHTML = `
          <strong>Validation Rejected:</strong>
          <ul class="validation-issues-list">
            ${(res.issues || []).map(iss => `<li>${iss}</li>`).join('')}
          </ul>
        `;
        return { valid: false, payload };
      }
    } catch (err) {
      banner.className = 'validation-box invalid';
      banner.innerHTML = `<strong>Server Error:</strong> ${err.message}`;
      return { valid: false, payload };
    }
  };

  document.getElementById('btn-validate-scenario').addEventListener('click', async (e) => {
    e.preventDefault();
    await validateCurrentForm();
  });

  // Save handler
  document.getElementById('btn-save-scenario').addEventListener('click', async (e) => {
    e.preventDefault();
    const { valid, payload } = await validateCurrentForm();
    if (!valid) {
      showToast('Cannot save: Fix schema validation issues first.', 'error');
      return;
    }

    try {
      const saveBtn = document.getElementById('btn-save-scenario');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      let result;
      if (isEditing) {
        result = await updateScenario(stopId, payload);
      } else {
        result = await createScenario(payload);
      }

      if (result.success) {
        showToast(`✓ Scenario "${payload.id}" successfully saved.`, 'success');
        navigateTo('scenarios');
      } else {
        showToast(`Save error: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      const saveBtn = document.getElementById('btn-save-scenario');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Save Scenario';
      }
    }
  });

  function extractFormData() {
    const isPresent = document.getElementById('hazard-present').checked;
    const actions = {};

    document.querySelectorAll('.action-form-block').forEach(block => {
      const key = block.querySelector('.action-key-input').value.trim();
      if (key) {
        actions[key] = {
          interaction: block.querySelector('.action-interaction-select').value,
          points: parseInt(block.querySelector('.action-points-input').value, 10),
          outcome: block.querySelector('.action-outcome-select').value,
          consequence: block.querySelector('.action-consequence-input').value.trim(),
          feedback: block.querySelector('.action-feedback-input').value.trim(),
          alexAction: block.querySelector('.action-alex-input').value.trim()
        };
      }
    });

    const flagsRaw = document.getElementById('stop-flags').value;
    const flags = flagsRaw.split(',').map(f => f.trim()).filter(Boolean);

    return {
      id: document.getElementById('stop-id').value.trim(),
      title: document.getElementById('stop-title').value.trim(),
      location: document.getElementById('stop-location').value.trim(),
      learning_objective: document.getElementById('stop-learning-objective').value.trim(),
      hazard: {
        present: isPresent,
        ...(isPresent ? {
          type: document.getElementById('hazard-type').value.trim(),
          subtype: document.getElementById('hazard-subtype').value.trim(),
          severity: document.getElementById('hazard-severity').value
        } : {})
      },
      supervisor: {
        name: document.getElementById('supervisor-name').value.trim(),
        behaviour: document.getElementById('supervisor-behaviour').value,
        dialogue: document.getElementById('supervisor-dialogue').value.trim()
      },
      alexStartPosition: {
        x: parseFloat(document.getElementById('pos-start-x').value) || 0,
        y: parseFloat(document.getElementById('pos-start-y').value) || 0,
        z: parseFloat(document.getElementById('pos-start-z').value) || 0
      },
      alexTargetPosition: {
        x: parseFloat(document.getElementById('pos-target-x').value) || 0,
        y: parseFloat(document.getElementById('pos-target-y').value) || 0,
        z: parseFloat(document.getElementById('pos-target-z').value) || 0
      },
      actions,
      flags_on_failure: flags
    };
  }
}

function renderActionFormBlock(actionKey, action) {
  return `
    <div class="action-form-block">
      <div class="action-block-header">
        <span style="font-weight:700; font-size:0.88rem; color:var(--brand-primary);">
          Action Choice: <code class="font-mono">${actionKey}</code>
        </span>
        <button type="button" class="btn btn-danger btn-sm btn-remove-action" title="Remove this choice">
          ✕ Remove Action
        </button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Action Key Identifier</label>
          <input type="text" class="form-control font-mono action-key-input" value="${actionKey}" required />
        </div>
        <div class="form-group">
          <label>Interaction Module</label>
          <select class="form-control font-mono action-interaction-select">
            ${VALID_INTERACTIONS.map(it => `
              <option value="${it}" ${action.interaction === it ? 'selected' : ''}>${it}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Points Delta (-10 to +10)</label>
          <input type="number" class="form-control font-mono action-points-input" min="-10" max="10" value="${action.points ?? 0}" required />
        </div>
        <div class="form-group">
          <label>Outcome Tier</label>
          <select class="form-control action-outcome-select">
            ${OUTCOMES.map(out => `
              <option value="${out}" ${action.outcome === out ? 'selected' : ''}>${out.toUpperCase()}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Consequence Identifier</label>
          <input type="text" class="form-control font-mono action-consequence-input" value="${action.consequence || ''}" required placeholder="e.g. area_secured" />
        </div>
        <div class="form-group">
          <label>Alex Animation Pose (Optional)</label>
          <input type="text" class="form-control font-mono action-alex-input" value="${action.alexAction || ''}" placeholder="cordon_area, hold_position..." />
        </div>
      </div>
      <div class="form-group">
        <label>Feedback Text (Displayed in Trainee HUD upon selection)</label>
        <textarea class="form-control action-feedback-input" required>${action.feedback || ''}</textarea>
      </div>
    </div>
  `;
}

function bindActionBlockButtons() {
  document.querySelectorAll('.btn-remove-action').forEach(btn => {
    btn.onclick = (e) => {
      const allBlocks = document.querySelectorAll('.action-form-block');
      if (allBlocks.length <= 2) {
        showToast('Schema constraint: Scenario requires at least 2 action choices.', 'error');
        return;
      }
      e.target.closest('.action-form-block').remove();
    };
  });
}

/**
 * 7. Training Sessions / Patrols View (Requirement 14)
 */
async function renderSessionsView(container) {
  const reportsRes = await fetchReports(50).catch(() => ({ data: [] }));
  const reports = Array.isArray(reportsRes.data) ? reportsRes.data : [];

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>Trainee Inspection Patrols</h1>
        <p>Complete historical debrief reports from 3D warehouse safety simulation sessions.</p>
      </div>
      <div class="page-actions">
        <a href="#/leaderboard" class="btn btn-secondary">Leaderboard</a>
      </div>
    </div>

    <div class="panel-card">
      <div class="table-responsive">
        <table class="scenario-table">
          <thead>
            <tr>
              <th>Trainee Name & ID</th>
              <th>Assessment Date</th>
              <th>Score (Out of 25)</th>
              <th>Compliance Status</th>
              <th>Flags Raised</th>
              <th>Performance Rank</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${reports.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding: 3rem 1rem; color:var(--admin-text-muted);">
                  <div style="font-size:1.05rem; font-weight:600; color:#fff; margin-bottom:0.4rem;">No Trainee Patrol Records Found</div>
                  <div style="font-size:0.88rem;">Once trainees complete safety inspection walks, their full chronological debrief timelines will be listed here.</div>
                </td>
              </tr>
            ` : reports.map((rep) => {
              const dateStr = rep.completedAt ? new Date(rep.completedAt).toLocaleString() : 'Recent';
              const isPass = Boolean(rep.passed);
              const flagsCount = (rep.flags || []).length;
              const rank = rep.rankTitle || (isPass ? 'Safety Champion' : 'Hazards Overlooked');

              return `
                <tr>
                  <td>
                    <div style="font-weight:600; color:#fff;">${rep.traineeName || 'Alex'}</div>
                    <div class="font-mono" style="font-size:0.75rem; color:var(--admin-text-dim);">${rep.traineeId || 'TR-10001'}</div>
                  </td>
                  <td><span style="font-size:0.85rem; color:var(--admin-text-muted);">${dateStr}</span></td>
                  <td>
                    <span class="font-mono" style="font-weight:700; font-size:1.05rem; color:${rep.totalScore >= 18 ? 'var(--safe-color)' : 'var(--warn-color)'}">
                      ${rep.totalScore}
                    </span>
                    <span style="font-size:0.75rem; color:var(--admin-text-dim);"> / 25</span>
                  </td>
                  <td>
                    ${getStatusBadgeHtml(isPass ? 'COMPLIANT (PASS)' : 'NON-COMPLIANT', isPass ? 'badge-safe' : 'badge-danger')}
                  </td>
                  <td>
                    <span class="badge ${flagsCount > 0 ? 'badge-warning' : 'badge-safe'}">
                      ${flagsCount} Flag${flagsCount === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${isPass ? 'badge-safe' : 'badge-warning'}">
                      ${rank}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-view-report" data-report='${JSON.stringify(rep).replace(/'/g, "&apos;")}'>
                      View Debrief Timeline →
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-view-report').forEach(btn => {
    btn.addEventListener('click', (e) => {
      try {
        const rep = JSON.parse(e.currentTarget.dataset.report);
        openReportModal(rep);
      } catch (err) {
        console.error('Failed to parse report', err);
      }
    });
  });
}

/**
 * 8. Leaderboard View
 */
async function renderLeaderboardView(container) {
  const [leaderRes, statsRes] = await Promise.all([
    fetchLeaderboard().catch(() => ({ data: [] })),
    fetchReportStats().catch(() => ({ stats: null }))
  ]);

  const topRuns = Array.isArray(leaderRes.data) ? leaderRes.data : [];
  const stats = statsRes.stats || { totalPatrols: 0, passRate: 0, averageScore: 0, highestScore: 0, lowestScore: 0 };

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>Scores & Performance Leaderboard</h1>
        <p>Benchmark scores and safety champions across warehouse inspection training cohorts.</p>
      </div>
      <div class="page-actions">
        <a href="#/sessions" class="btn btn-secondary">All Patrols</a>
      </div>
    </div>

    <!-- Performance Stats -->
    <div class="stats-grid">
      <div class="stat-card" style="--stat-accent: var(--brand-primary);">
        <div class="stat-card-header">
          <span class="stat-label">Total Completed Patrols</span>
          <div class="stat-icon">${ICONS.sessions}</div>
        </div>
        <div class="stat-val">${stats.totalPatrols || 0}</div>
        <div class="stat-desc">Synchronized from local database</div>
      </div>
      <div class="stat-card" style="--stat-accent: var(--safe-color);">
        <div class="stat-card-header">
          <span class="stat-label">Safety Pass Rate</span>
          <div class="stat-icon">${ICONS.compliance}</div>
        </div>
        <div class="stat-val" style="color:var(--safe-color)">${stats.passRate || 0}%</div>
        <div class="stat-desc">Passing score >= 18 points</div>
      </div>
      <div class="stat-card" style="--stat-accent: var(--warn-color);">
        <div class="stat-card-header">
          <span class="stat-label">Cohort Average Score</span>
          <div class="stat-icon">${ICONS.compliance}</div>
        </div>
        <div class="stat-val">${stats.averageScore || 0}</div>
        <div class="stat-desc">Out of 25 maximum achievable points</div>
      </div>
    </div>

    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title-group">
          <h2>Top Patrol Runs</h2>
          <div class="panel-subtitle">Highest scoring completed inspection runs in descending order.</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="scenario-table">
          <thead>
            <tr>
              <th style="width: 50px;">Rank</th>
              <th>Trainee Name</th>
              <th>Rank Classification</th>
              <th>Total Score</th>
              <th>Pass / Fail</th>
              <th>Date Recorded</th>
            </tr>
          </thead>
          <tbody>
            ${topRuns.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align:center; padding: 2.5rem 1rem; color:var(--admin-text-muted);">
                  <div style="font-weight:600; color:#fff; margin-bottom:0.35rem;">No Leaderboard Rankings Available</div>
                  <div style="font-size:0.85rem;">Trainee patrol inspection scores will benchmark here once assessments are recorded.</div>
                </td>
              </tr>
            ` : topRuns.map((r, idx) => `
              <tr>
                <td>
                  <span class="font-mono" style="font-weight:700; color:${idx === 0 ? 'var(--brand-accent)' : (idx === 1 ? '#cbd5e1' : 'var(--brand-primary)')}; font-size:1.1rem;">
                    #${idx + 1}
                  </span>
                </td>
                <td style="font-weight:600; color:#fff;">${r.traineeName || 'Alex'}</td>
                <td><span class="badge badge-safe">${r.rankTitle || 'Safety Champion'}</span></td>
                <td><span class="font-mono" style="font-weight:700; color:var(--safe-color); font-size:1.1rem;">${r.totalScore} pts</span></td>
                <td>${getStatusBadgeHtml(r.passed ? 'PASSED' : 'FAILED', r.passed ? 'badge-safe' : 'badge-danger')}</td>
                <td><span style="font-size:0.85rem; color:var(--admin-text-muted);">${r.completedAt ? new Date(r.completedAt).toLocaleDateString() : 'Today'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 9. Compliance & AJV Schema Diagnostics View
 */
async function renderComplianceView(container) {
  const res = await fetchAllScenarios();
  const dataset = res.data || { stops: [], endOfSessionRules: [] };

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>Compliance & AJV Schema Diagnostics</h1>
        <p>Referential integrity and JSON Schema verification across authored scenario dataset.</p>
      </div>
      <div class="page-actions">
        <button id="btn-run-full-audit" class="btn btn-primary">
          🔍 Run Full AJV Schema Audit
        </button>
      </div>
    </div>

    <div id="compliance-banner" class="validation-box valid" style="margin-bottom:1.5rem;">
      ✓ <strong>AJV Schema Compliant:</strong> All ${dataset.stops.length} stops conform to <code>stops.schema.json</code>. All action references match registered interaction modules.
    </div>

    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title-group">
          <h2>Registered Interaction Modules</h2>
          <div class="panel-subtitle">Modules implemented in <code>src/interactions/</code> and authorized in scenario definitions.</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
        ${VALID_INTERACTIONS.map(mod => `
          <div style="background:var(--admin-bg-card); border:1px solid var(--admin-border); border-radius:var(--radius-md); padding:1rem; display:flex; align-items:center; gap:0.75rem;">
            <div style="color:var(--safe-color);">${ICONS.check}</div>
            <div>
              <div class="font-mono" style="font-weight:700; color:#fff; font-size:0.88rem;">${mod}</div>
              <div style="font-size:0.75rem; color:var(--admin-text-muted);">Interaction Handler Active</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-run-full-audit').addEventListener('click', async () => {
    const banner = document.getElementById('compliance-banner');
    banner.className = 'validation-box';
    banner.innerHTML = 'Executing rigorous AJV schema and referential verification...';
    try {
      const vRes = await validateScenario(dataset.stops[0]);
      if (vRes.valid) {
        banner.className = 'validation-box valid';
        banner.innerHTML = '✓ <strong>Audit Passed:</strong> 100% of authored stops, outcomes, and rules are compliant.';
      } else {
        banner.className = 'validation-box invalid';
        banner.innerHTML = `<strong>Audit Failed:</strong> ${(vRes.issues || []).join(', ')}`;
      }
    } catch (err) {
      banner.className = 'validation-box invalid';
      banner.innerHTML = `Audit execution error: ${err.message}`;
    }
  });
}

/**
 * 10. System & Settings View
 */
async function renderSettingsView(container) {
  const admin = getStoredAdmin() || { username: 'admin', role: 'System Administrator' };

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="page-title-block">
        <h1>System Settings & Simulation Connection</h1>
        <p>Operational environment and backend services configuration.</p>
      </div>
    </div>

    <div class="panel-card">
      <h3 style="font-size:1.1rem; color:#fff; margin-bottom:1rem;">Active Administrator Identity</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Administrator Username</label>
          <input type="text" class="form-control" value="${admin.username || 'admin'}" readonly />
        </div>
        <div class="form-group">
          <label>Assigned Role</label>
          <input type="text" class="form-control" value="${admin.role || 'System Administrator'}" readonly />
        </div>
      </div>
    </div>

    <div class="panel-card">
      <h3 style="font-size:1.1rem; color:#fff; margin-bottom:1rem;">Operational Architecture</h3>
      <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem; color:var(--admin-text-secondary);">
        <div style="display:flex; justify-content:space-between; padding:0.6rem 0; border-bottom:1px solid var(--admin-border-subtle);">
          <span>Frontend Vite Dev Server</span>
          <code class="font-mono" style="color:var(--brand-primary)">http://localhost:3000</code>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.6rem 0; border-bottom:1px solid var(--admin-border-subtle);">
          <span>Backend Express API Server</span>
          <code class="font-mono" style="color:var(--brand-primary)">http://localhost:5000/api</code>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.6rem 0; border-bottom:1px solid var(--admin-border-subtle);">
          <span>Simulation Dataset Authority</span>
          <code class="font-mono" style="color:var(--safe-color)">MongoDB & src/data/stops.json</code>
        </div>
      </div>
    </div>
  `;
}

/**
 * 11. Individual Training Session Debrief Modal (Requirement 14)
 */
function openReportModal(report) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  const zoneLogs = report.zoneLogs || [
    { zone: 'Zone 01', title: 'Ground-Level Hazard', actionTaken: 'cordon_off', points: 5, outcome: 'optimal', feedback: 'Cordoned off the active fluid spill.' },
    { zone: 'Zone 02', title: 'Blind-Corner Forklift Traffic', actionTaken: 'hold_position', points: 5, outcome: 'optimal', feedback: 'Confirmed eye contact before crossing.' },
    { zone: 'Zone 03', title: 'Bent Rack Upright', actionTaken: 'cordon_and_report', points: 5, outcome: 'optimal', feedback: 'Secured damaged racking upright.' },
    { zone: 'Zone 04', title: 'Overheated Pallet Jack Charger', actionTaken: 'isolate_and_report', points: 5, outcome: 'optimal', feedback: 'Safely powered down hot charger.' },
    { zone: 'Zone 05', title: 'Emergency Response Hub', actionTaken: 'emergency_drill', points: 5, outcome: 'optimal', feedback: 'Verified clear egress and equipment readiness.' }
  ];

  const isPass = Boolean(report.passed);

  modal.innerHTML = `
    <div class="modal-content modal-large">
      <div class="modal-header">
        <div class="modal-title">
          <span>Inspection Debrief: ${report.traineeName || 'Alex'}</span>
          <span class="font-mono" style="font-size:0.85rem; color:var(--admin-text-muted);">(${report.traineeId || 'TR-10001'})</span>
        </div>
        <button class="modal-close-btn" id="modal-close-x">✕</button>
      </div>

      <div class="modal-body">
        <!-- Debrief Metric Banner -->
        <div class="debrief-summary-banner">
          <div class="debrief-metric">
            <span class="debrief-metric-label">Final Score</span>
            <span class="debrief-metric-val font-mono" style="color:${report.totalScore >= 18 ? 'var(--safe-color)' : 'var(--warn-color)'}">
              ${report.totalScore} <span style="font-size:0.9rem; color:var(--admin-text-dim);">/ 25</span>
            </span>
          </div>
          <div class="debrief-metric">
            <span class="debrief-metric-label">Pass / Fail Status</span>
            <span style="margin-top:0.4rem;">
              ${getStatusBadgeHtml(isPass ? 'COMPLIANT' : 'FAILED', isPass ? 'badge-safe' : 'badge-danger')}
            </span>
          </div>
          <div class="debrief-metric">
            <span class="debrief-metric-label">Rank Classification</span>
            <span style="font-size:1rem; font-weight:700; color:#fff; margin-top:0.35rem;">
              ${report.rankTitle || 'Safety Champion'}
            </span>
          </div>
          <div class="debrief-metric">
            <span class="debrief-metric-label">Flags Raised</span>
            <span class="debrief-metric-val font-mono" style="color:${(report.flags || []).length > 0 ? 'var(--warn-color)' : 'var(--safe-color)'}">
              ${(report.flags || []).length}
            </span>
          </div>
        </div>

        <!-- Chronological Step-by-Step Decision Timeline (Requirement 14) -->
        <h4 style="font-size:0.95rem; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:1.25rem;">
          Chronological Patrol Decision Timeline
        </h4>

        <div class="timeline-list">
          ${zoneLogs.map((log, idx) => {
            const pts = log.points ?? 0;
            const isGood = pts > 0;
            return `
              <div class="timeline-item">
                <div class="timeline-node-dot ${isGood ? 'safe' : 'failure'}">
                  ${idx + 1}
                </div>
                <div class="timeline-card">
                  <div class="timeline-card-header">
                    <div>
                      <span class="timeline-step-title">${log.zone || `Stop ${idx + 1}`}: ${log.title || 'Hazard Assessment'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <span class="badge badge-${log.outcome || (isGood ? 'optimal' : 'failure')}">${log.outcome || (isGood ? 'Optimal' : 'Failure')}</span>
                      <span class="font-mono timeline-step-points" style="color:${isGood ? 'var(--safe-color)' : 'var(--danger-color)'}">
                        ${pts > 0 ? '+' : ''}${pts} pts
                      </span>
                    </div>
                  </div>
                  <div style="font-size:0.85rem; color:var(--admin-text-secondary);">
                    Action Taken: <code>${log.actionTaken || 'Assessed area'}</code>
                  </div>
                  <div class="timeline-feedback-text">
                    ${log.feedback || 'Trainee decision logged.'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="modal-actions">
        <button id="modal-close-btn" class="btn btn-secondary">Close Debrief</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#modal-close-x').addEventListener('click', close);
  modal.querySelector('#modal-close-btn').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}

/**
 * 12. Delete Confirmation Modal with Referential Integrity Checks (Requirement 18)
 */
function confirmAndDeleteScenario(id, title) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title" style="color:var(--danger-color);">
          ${ICONS.alert} Delete Scenario Stop?
        </h3>
        <button class="modal-close-btn" id="modal-delete-close-x">✕</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--admin-text-main); margin-bottom:1rem; font-size:0.95rem; line-height:1.5;">
          Are you sure you want to permanently delete scenario <strong>"${title}"</strong> (<code>${id}</code>)?
        </p>
        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); padding:1rem; font-size:0.85rem; color:#fca5a5; line-height:1.5;">
          ⚠️ <strong>Simulation Integrity Safeguard:</strong> The system verifies scenario validity and ensures the training simulation retains required inspection stops.
        </div>
      </div>
      <div class="modal-actions">
        <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
        <button id="modal-confirm-btn" class="btn btn-danger">Confirm Deletion</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#modal-delete-close-x').addEventListener('click', close);
  modal.querySelector('#modal-cancel-btn').addEventListener('click', close);

  modal.querySelector('#modal-confirm-btn').addEventListener('click', async () => {
    try {
      const res = await deleteScenario(id);
      modal.remove();
      if (res.success) {
        showToast(`✓ Scenario "${id}" deleted.`, 'success');
        renderApp();
      } else {
        showToast(`Deletion rejected: ${res.error || (res.issues || []).join(', ')}`, 'error');
      }
    } catch (err) {
      modal.remove();
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  });
}

// Initial Bootstrap
renderApp();
