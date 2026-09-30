/**
 * adminApp.js
 * Core Single-Page Admin Application for Two Pairs of Eyes.
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
  publishScenarios
} from './adminApi.js';

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
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Router Dispatcher
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
 * Main Render Controller
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

  // Render Layout Shell with Top Navbar
  const admin = getStoredAdmin();
  appRoot.innerHTML = `
    <nav class="admin-navbar">
      <a href="#/dashboard" class="admin-brand">
        <img src="/technova-logo-white.svg" alt="TechNova Logo" class="admin-logo-img" onerror="this.style.display='none'" />
        <div class="admin-brand-text">
          <span class="admin-sys-title">SYSTEM ADMIN</span>
          <span class="admin-app-name">Two Pairs of Eyes</span>
        </div>
      </a>
      <div class="admin-nav-links">
        <a href="#/dashboard" class="nav-item ${page === 'dashboard' ? 'active' : ''}">Dashboard</a>
        <a href="#/scenarios" class="nav-item ${page === 'scenarios' ? 'active' : ''}">Scenarios</a>
        <a href="/" class="nav-item" target="_blank" title="Launch Trainee Simulation">Launch Simulation ↗</a>
        <div class="admin-user-pill">
          <span class="admin-avatar-dot"></span>
          <span>${admin ? admin.username : 'admin'}</span>
        </div>
        <button id="btn-logout" class="btn btn-secondary btn-sm">Logout</button>
      </div>
    </nav>
    <main class="admin-container" id="admin-view-container"></main>
  `;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await adminLogout();
    showToast('Logged out successfully.');
    navigateTo('login');
  });

  const viewContainer = document.getElementById('admin-view-container');

  try {
    if (page === 'dashboard') {
      await renderDashboardView(viewContainer);
    } else if (page === 'scenarios') {
      if (id === 'new') {
        renderScenarioForm(viewContainer, null);
      } else if (id) {
        await renderScenarioForm(viewContainer, id);
      } else {
        await renderScenariosListView(viewContainer);
      }
    } else {
      navigateTo('dashboard');
    }
  } catch (err) {
    viewContainer.innerHTML = `
      <div class="panel-card">
        <h3 style="color:var(--admin-accent-red)">Error loading view</h3>
        <p style="margin:1rem 0; color:var(--admin-text-muted)">${err.message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()">Retry</button>
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
        <img src="/technova-logo-white.svg" alt="TechNova Logo" style="height:36px; margin-bottom:0.75rem;" onerror="this.style.display='none'" />
        <div class="admin-sys-title">SYSTEM ADMIN</div>
        <h2>Two Pairs of Eyes</h2>
        <p style="color:var(--admin-text-muted); font-size:0.88rem; margin-top:0.3rem;">Authorised Scenario Content Management</p>
      </div>

      <div id="login-error-banner" class="validation-box invalid" style="display:none; margin-bottom:1.25rem;"></div>

      <form id="admin-login-form" class="admin-form">
        <div class="form-group">
          <label for="admin-user">Administrator Username</label>
          <input type="text" id="admin-user" class="form-control" placeholder="Enter username (e.g. admin)" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="admin-pass">Password</label>
          <input type="password" id="admin-pass" class="form-control" placeholder="Enter administrator password" required autocomplete="current-password" />
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--admin-text-muted);">
          <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <input type="checkbox" id="admin-remember" checked /> Remember session
          </label>
          <a href="/" style="color:var(--admin-accent-cyan); text-decoration:none;">Simulation Portal ↗</a>
        </div>
        <button type="submit" id="admin-submit-btn" class="btn btn-primary" style="justify-content:center; padding:0.75rem;">
          Authenticate as Administrator
        </button>
      </form>
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
        showToast('✓ Authentication granted.');
        navigateTo('dashboard');
      } else {
        errorBanner.innerText = res.error || 'Authentication failed. Please verify credentials.';
        errorBanner.style.display = 'block';
      }
    } catch {
      errorBanner.innerText = 'Unable to reach backend server. Please verify Express is running on port 5000.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Authenticate as Administrator';
    }
  });
}

/**
 * 2. Dashboard View
 */
async function renderDashboardView(container) {
  const res = await fetchAllScenarios();
  const dataset = res.data || { stops: [], endOfSessionRules: [] };
  const stops = dataset.stops || [];
  const rules = dataset.endOfSessionRules || [];

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-header-titles">
        <h1>Dashboard</h1>
        <p>Two Pairs of Eyes — Safety Scenario Content Management System</p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button id="btn-publish-all" class="btn btn-success">
          ✓ Save & Publish to Simulation
        </button>
        <a href="#/scenarios/new" class="btn btn-primary">
          + Add Scenario
        </a>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Active Stops</span>
        <span class="stat-val">${stops.length}</span>
        <span class="stat-desc">Sequential safety inspection stops</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Hazards Defined</span>
        <span class="stat-val">${stops.filter(s => s.hazard?.present).length}</span>
        <span class="stat-desc">Active warehouse safety hazards</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Deferred Rules</span>
        <span class="stat-val">${rules.length}</span>
        <span class="stat-desc">Cross-stop consequence rules</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">AJV Validation</span>
        <span class="stat-val" style="color:var(--admin-accent-green); font-size:1.4rem;">Compliant</span>
        <span class="stat-desc">All stops conform to stops.schema.json</span>
      </div>
    </div>

    <!-- Scenario Management Section -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Scenario Management</h2>
          <p style="font-size:0.85rem; color:var(--admin-text-muted); margin-top:0.2rem;">
            Current authored training stops evaluated in the 3D warehouse patrol.
          </p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a href="#/scenarios" class="btn btn-secondary btn-sm">View Scenarios</a>
          <a href="#/scenarios/new" class="btn btn-primary btn-sm">+ Add Scenario</a>
        </div>
      </div>

      <table class="scenario-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Stop ID</th>
            <th>Scenario Title</th>
            <th>Supervisor Mode</th>
            <th>Hazard Status</th>
            <th>Actions</th>
            <th>Operations</th>
          </tr>
        </thead>
        <tbody>
          ${stops.map((stop, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const behaviour = stop.supervisor?.behaviour || 'dismissive';
            const hazardPresent = stop.hazard?.present;
            const hazardText = hazardPresent ? `${stop.hazard.severity} (${stop.hazard.type})` : 'Clear Zone';
            const actionCount = Object.keys(stop.actions || {}).length;

            return `
              <tr>
                <td style="font-weight:700; color:var(--admin-accent-cyan);">${num}</td>
                <td><code>${stop.id}</code></td>
                <td style="font-weight:600; color:#fff;">${stop.title}</td>
                <td><span class="badge badge-${behaviour}">${behaviour}</span></td>
                <td>
                  <span style="font-size:0.82rem; color:${hazardPresent ? 'var(--admin-accent-amber)' : 'var(--admin-accent-green)'}">
                    ${hazardPresent ? '⚠️ ' + hazardText : '✓ Compliant'}
                  </span>
                </td>
                <td><span class="badge badge-neutral">${actionCount} options</span></td>
                <td>
                  <div style="display:flex; gap:0.4rem;">
                    <a href="#/scenarios/${stop.id}" class="btn btn-secondary btn-sm">Edit</a>
                    <button class="btn btn-danger btn-sm btn-delete-scenario" data-id="${stop.id}" data-title="${stop.title}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind Publish Button
  document.getElementById('btn-publish-all').addEventListener('click', async () => {
    try {
      const pubRes = await publishScenarios();
      if (pubRes.success) {
        showToast('✓ Scenarios successfully published and synchronized with simulation.', 'success');
      } else {
        showToast(`Publish error: ${pubRes.error}`, 'error');
      }
    } catch (err) {
      showToast(`Publish failed: ${err.message}`, 'error');
    }
  });

  // Bind Delete buttons with confirmation
  container.querySelectorAll('.btn-delete-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const title = e.currentTarget.dataset.title;
      confirmAndDeleteScenario(id, title, rules);
    });
  });
}

/**
 * 3. Scenarios List View
 */
async function renderScenariosListView(container) {
  const res = await fetchAllScenarios();
  const dataset = res.data || { stops: [], endOfSessionRules: [] };
  const stops = dataset.stops || [];
  const rules = dataset.endOfSessionRules || [];

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-header-titles">
        <h1>All Training Scenarios</h1>
        <p>Review, modify, or validate scenario stops used by the simulation.</p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button id="btn-publish-list" class="btn btn-success">✓ Publish Changes</button>
        <a href="#/scenarios/new" class="btn btn-primary">+ Add New Scenario</a>
      </div>
    </div>

    <div class="panel-card">
      <table class="scenario-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Stop ID</th>
            <th>Title & Location</th>
            <th>Supervisor Dialogue</th>
            <th>Hazard</th>
            <th>Outcome Options</th>
            <th>Operations</th>
          </tr>
        </thead>
        <tbody>
          ${stops.map((stop, idx) => {
            const behaviour = stop.supervisor?.behaviour || 'dismissive';
            const actions = Object.values(stop.actions || {});
            return `
              <tr>
                <td style="font-weight:700; color:var(--admin-accent-cyan); font-size:1.1rem;">
                  ${String(idx + 1).padStart(2, '0')}
                </td>
                <td><code>${stop.id}</code></td>
                <td>
                  <div style="font-weight:600; color:#fff;">${stop.title}</div>
                  <div style="font-size:0.78rem; color:var(--admin-text-muted);">${stop.location}</div>
                </td>
                <td style="max-width:280px; font-size:0.85rem;">
                  <span class="badge badge-${behaviour}" style="margin-bottom:0.25rem;">${stop.supervisor?.name || 'Dave'} (${behaviour})</span>
                  <div style="color:var(--admin-text-muted); font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${stop.supervisor?.dialogue || ''}">
                    "${stop.supervisor?.dialogue || ''}"
                  </div>
                </td>
                <td>
                  ${stop.hazard?.present 
                    ? `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;">${stop.hazard.severity} • ${stop.hazard.type}</span>`
                    : `<span class="badge badge-correct">Clear</span>`}
                </td>
                <td>
                  <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">
                    ${actions.map(a => `<span class="badge badge-${a.outcome}">${a.outcome} (${a.points > 0 ? '+' : ''}${a.points})</span>`).join('')}
                  </div>
                </td>
                <td>
                  <div style="display:flex; gap:0.4rem;">
                    <a href="#/scenarios/${stop.id}" class="btn btn-secondary btn-sm">Edit</a>
                    <button class="btn btn-danger btn-sm btn-delete-scenario" data-id="${stop.id}" data-title="${stop.title}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-publish-list').addEventListener('click', async () => {
    try {
      const pubRes = await publishScenarios();
      if (pubRes.success) {
        showToast('✓ Scenarios successfully published and synchronized with simulation.', 'success');
      } else {
        showToast(`Publish error: ${pubRes.error}`, 'error');
      }
    } catch (err) {
      showToast(`Publish failed: ${err.message}`, 'error');
    }
  });

  container.querySelectorAll('.btn-delete-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const title = e.currentTarget.dataset.title;
      confirmAndDeleteScenario(id, title, rules);
    });
  });
}

/**
 * 4. Scenario Add / Edit Form View
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
    // Default template for a new scenario
    stopData = {
      id: `stop_${Date.now().toString().slice(-4)}`,
      title: 'New Safety Stop',
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
        dialogue: 'Watch out around here, but keep moving.'
      },
      alexStartPosition: { x: 0, y: 0, z: -10 },
      alexTargetPosition: { x: 0, y: 0, z: -12 },
      actions: {
        action_opt: {
          interaction: 'cordonOff',
          points: 5,
          outcome: 'optimal',
          consequence: 'hazard_controlled',
          feedback: 'Excellent response. You controlled the risk immediately.',
          alexAction: 'cordon_area'
        },
        action_rep: {
          interaction: 'report',
          points: 3,
          outcome: 'partial',
          consequence: 'reported_pending_action',
          feedback: 'Reporting is good, but immediate containment was required.',
          alexAction: 'move_to_safety'
        },
        action_ign: {
          interaction: 'ignore',
          points: -3,
          outcome: 'failure',
          consequence: 'near_miss_unaddressed',
          feedback: 'Ignoring hazards puts colleagues at serious risk.',
          alexAction: 'follow_dave'
        }
      },
      flags_on_failure: ['unaddressed_hazard'],
      learning_objective: 'Identify and mitigate active warehouse hazards immediately.'
    };
  }

  const actionsKeys = Object.keys(stopData.actions || {});

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-header-titles">
        <h1>${isEditing ? `Edit Scenario: ${stopData.title}` : 'Add New Scenario'}</h1>
        <p>${isEditing ? `Editing stop ID: ${stopData.id}` : 'Create a new schema-compliant safety stop'}</p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <a href="#/scenarios" class="btn btn-secondary">Cancel</a>
        <button id="btn-validate-scenario" class="btn btn-secondary">
          🔍 Validate Data
        </button>
        <button id="btn-save-scenario" class="btn btn-primary">
          💾 Save Scenario
        </button>
      </div>
    </div>

    <!-- Validation Result Banner -->
    <div id="form-validation-banner" class="validation-box" style="display:none;"></div>

    <form id="scenario-edit-form" class="admin-form">
      <!-- Section 1: Identification & General Info -->
      <div class="form-section">
        <h3 class="form-section-title">1. Scenario Identification & Metadata</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="stop-id">Stop ID (Pattern: a-z, 0-9, _)</label>
            <input type="text" id="stop-id" class="form-control" value="${stopData.id}" required pattern="^[a-z0-9_]+$" />
          </div>
          <div class="form-group">
            <label for="stop-title">Scenario Title / Name</label>
            <input type="text" id="stop-title" class="form-control" value="${stopData.title}" required />
          </div>
          <div class="form-group">
            <label for="stop-location">Location Identifier</label>
            <input type="text" id="stop-location" class="form-control" value="${stopData.location}" required />
          </div>
        </div>
        <div class="form-group">
          <label for="stop-learning-objective">Learning Objective</label>
          <input type="text" id="stop-learning-objective" class="form-control" value="${stopData.learning_objective || ''}" required />
        </div>
      </div>

      <!-- Section 2: Hazard Configuration -->
      <div class="form-section">
        <h3 class="form-section-title">2. Hazard Definition</h3>
        <div class="form-row">
          <div class="form-group" style="justify-content:center;">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; text-transform:none; font-size:0.95rem; color:#fff;">
              <input type="checkbox" id="hazard-present" ${stopData.hazard?.present ? 'checked' : ''} />
              Hazard is Present in this Zone
            </label>
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-type">Hazard Type</label>
            <input type="text" id="hazard-type" class="form-control" value="${stopData.hazard?.type || 'ground_level'}" />
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-subtype">Hazard Subtype (Optional)</label>
            <input type="text" id="hazard-subtype" class="form-control" value="${stopData.hazard?.subtype || ''}" />
          </div>
          <div class="form-group hazard-detail-group">
            <label for="hazard-severity">Severity Level</label>
            <select id="hazard-severity" class="form-control">
              ${HAZARD_SEVERITIES.map(sev => `
                <option value="${sev}" ${stopData.hazard?.severity === sev ? 'selected' : ''}>${sev}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Section 3: Supervisor Persona & Dialogue -->
      <div class="form-section">
        <h3 class="form-section-title">3. Dave / Supervisor Behaviour & Dialogue</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="supervisor-name">Supervisor Name</label>
            <input type="text" id="supervisor-name" class="form-control" value="${stopData.supervisor?.name || 'Dave'}" required />
          </div>
          <div class="form-group">
            <label for="supervisor-behaviour">Behaviour Mode</label>
            <select id="supervisor-behaviour" class="form-control">
              ${SUPERVISOR_BEHAVIOURS.map(b => `
                <option value="${b}" ${stopData.supervisor?.behaviour === b ? 'selected' : ''}>${b}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="supervisor-dialogue">Supervisor Spoken Dialogue</label>
          <textarea id="supervisor-dialogue" class="form-control" required>${stopData.supervisor?.dialogue || ''}</textarea>
        </div>
      </div>

      <!-- Section 4: Available Actions (Minimum 2 required by schema) -->
      <div class="form-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 class="form-section-title" style="margin:0;">4. Available Actions & Scoring (Min. 2)</h3>
          <button type="button" id="btn-add-action" class="btn btn-secondary btn-sm">+ Add Action Option</button>
        </div>
        <div id="actions-container" style="display:flex; flex-direction:column; gap:1rem;">
          ${actionsKeys.map((actionKey) => renderActionFormBlock(actionKey, stopData.actions[actionKey])).join('')}
        </div>
      </div>

      <!-- Section 5: Deferred Failure Flags & Spatial Coordinates -->
      <div class="form-section">
        <h3 class="form-section-title">5. Consequence Flags & 3D Coordinates</h3>
        <div class="form-group" style="margin-bottom:1rem;">
          <label for="stop-flags">Failure Flags (Comma-separated — triggers deferred consequence rules)</label>
          <input type="text" id="stop-flags" class="form-control" value="${(stopData.flags_on_failure || []).join(', ')}" placeholder="e.g. ignored_ground_hazard, near_miss_forklift" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Alex Start Position (X, Y, Z)</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="number" step="0.05" id="pos-start-x" class="form-control" value="${stopData.alexStartPosition?.x ?? 0}" placeholder="X" />
              <input type="number" step="0.05" id="pos-start-y" class="form-control" value="${stopData.alexStartPosition?.y ?? 0}" placeholder="Y" />
              <input type="number" step="0.05" id="pos-start-z" class="form-control" value="${stopData.alexStartPosition?.z ?? 0}" placeholder="Z" />
            </div>
          </div>
          <div class="form-group">
            <label>Alex Target Position (X, Y, Z)</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="number" step="0.05" id="pos-target-x" class="form-control" value="${stopData.alexTargetPosition?.x ?? 0}" placeholder="X" />
              <input type="number" step="0.05" id="pos-target-y" class="form-control" value="${stopData.alexTargetPosition?.y ?? 0}" placeholder="Y" />
              <input type="number" step="0.05" id="pos-target-z" class="form-control" value="${stopData.alexTargetPosition?.z ?? 0}" placeholder="Z" />
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
      feedback: 'Feedback for this option.',
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
        banner.innerHTML = '✓ <strong>Schema Valid:</strong> Scenario fully satisfies JSON schema, interaction registry, and referential constraints.';
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
        showToast(`✓ Scenario "${payload.id}" successfully saved.`);
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
    <div class="action-form-block" style="background:var(--admin-bg-surface); border:1px solid var(--admin-border); border-radius:8px; padding:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <span style="font-weight:700; font-size:0.85rem; color:var(--admin-accent-cyan);">Action Option: <code>${actionKey}</code></span>
        <button type="button" class="btn btn-danger btn-sm btn-remove-action" title="Remove Action">✕ Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Action Key</label>
          <input type="text" class="form-control action-key-input" value="${actionKey}" required />
        </div>
        <div class="form-group">
          <label>Interaction Module</label>
          <select class="form-control action-interaction-select">
            ${VALID_INTERACTIONS.map(it => `
              <option value="${it}" ${action.interaction === it ? 'selected' : ''}>${it}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Score Delta (-10 to +10)</label>
          <input type="number" class="form-control action-points-input" min="-10" max="10" value="${action.points ?? 0}" required />
        </div>
        <div class="form-group">
          <label>Outcome Tier</label>
          <select class="form-control action-outcome-select">
            ${OUTCOMES.map(out => `
              <option value="${out}" ${action.outcome === out ? 'selected' : ''}>${out}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Consequence Flag / ID</label>
          <input type="text" class="form-control action-consequence-input" value="${action.consequence || ''}" required />
        </div>
        <div class="form-group">
          <label>Alex Animation Action (Optional)</label>
          <input type="text" class="form-control action-alex-input" value="${action.alexAction || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label>Feedback Text (Displayed to trainee upon choosing)</label>
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
        showToast('Scenario requires at least 2 action choices according to schema.', 'error');
        return;
      }
      e.target.closest('.action-form-block').remove();
    };
  });
}

/**
 * Delete Confirmation Modal with Referential Integrity Checks
 */
function confirmAndDeleteScenario(id, title, endOfSessionRules = []) {
  // Check if any rule directly depends on this stop's flags
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3 class="modal-title">Confirm Scenario Deletion</h3>
      <p style="color:var(--admin-text-main); margin-bottom:1rem;">
        Are you sure you want to delete scenario <strong>"${title}"</strong> (<code>${id}</code>)?
      </p>
      <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:0.85rem; font-size:0.85rem; color:#f87171; margin-bottom:1rem;">
        ⚠️ <strong>Referential Integrity Check:</strong> The server will verify whether any deferred consequence rules depend on flags provided by this scenario. If referenced, deletion will be safely rejected.
      </div>
      <div class="modal-actions">
        <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
        <button id="modal-confirm-btn" class="btn btn-danger">Confirm Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#modal-confirm-btn').addEventListener('click', async () => {
    try {
      const res = await deleteScenario(id);
      modal.remove();
      if (res.success) {
        showToast(`✓ Scenario "${id}" deleted.`);
        renderApp();
      } else {
        showToast(`Deletion rejected: ${res.error}`, 'error');
      }
    } catch (err) {
      modal.remove();
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  });
}

// Initial bootstrap
renderApp();
