/**
 * HUD.js
 * 
 * Clean, borderless Top Navbar with Real-Time Safety Flagging & Live Audit Trail:
 *  - Left: Clean title & scenario metadata (Stop X of 5, Title, Location).
 *  - Center: Minimalist progress timeline (connected circular milestones).
 *  - Right: Real-Time Safety Flags badge (with live audit drawer toggle) & Live Score counter.
 */

const STOP_NAMES = [
  { id: 'stop_01', num: 1, name: 'Chemical Spill', zone: 'Facility 01 • Drum Storage' },
  { id: 'stop_02', num: 2, name: 'Blind Corner', zone: 'Facility 02 • Vehicle Transit' },
  { id: 'stop_03', num: 3, name: 'Pallet Racking', zone: 'Facility 03 • High-Bay Storage' },
  { id: 'stop_04', num: 4, name: 'Battery Station', zone: 'Facility 04 • Charging Bay' },
  { id: 'stop_05', num: 5, name: 'Loading Dock', zone: 'Facility 05 • Dispatch Area' },
];

export class HUD {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._el = document.getElementById('hud');
    this._stopIndex = 1;
    this._totalStops = 5;
    this._score = 0;
    this._currentStop = {
      id: 'stop_01',
      title: 'Ground-Level Fluid Hazard',
      location: 'Drum Storage Zone',
    };
    this._completedStops = new Set();
    this._flags = [];
    this._flagHistory = [];
    this._drawerOpen = false;

    this._render();

    eventBus.on('stop:entered', ({ stop }) => {
      this._stopIndex = parseInt(stop.id.split('_')[1], 10) || 1;
      this._currentStop = stop;
      this._render();
    });

    eventBus.on('score:changed', ({ total, outcome = '', points = 0, flags = [] }) => {
      this._score = total;
      if (this._stopIndex > 0) {
        this._completedStops.add(this._stopIndex);
      }
      this._flags = flags;
      this._render(points !== 0 ? (points > 0 ? `+${points}` : `${points}`) : '');
    });

    eventBus.on('flags:updated', ({ stopId, newFlags, allFlags }) => {
      this._flags = allFlags;
      newFlags.forEach((f) => {
        this._flagHistory.push({
          flag: f,
          stopId,
          stopTitle: this._currentStop?.title || 'Unknown Stop',
          time: new Date().toLocaleTimeString(),
        });
      });
      this._render();
      this._showFlagToast(newFlags);
    });

    eventBus.on('stop:completed', ({ stopId }) => {
      const idx = parseInt(stopId.split('_')[1], 10);
      if (idx) this._completedStops.add(idx);
      this._render();
    });
  }

  _showFlagToast(newFlags) {
    let flagToast = document.getElementById('flag-toast');
    if (!flagToast) return;
    const flagNames = newFlags.map(f => f.replace(/_/g, ' ').toUpperCase()).join(', ');
    flagToast.innerHTML = `
      <div class="flag-toast-card">
        <span class="flag-toast-icon">🚩</span>
        <div class="flag-toast-body">
          <strong>REAL-TIME SAFETY FLAG LOGGED</strong>
          <p>${flagNames} &bull; Safety compliance record updated</p>
        </div>
      </div>
    `;
    flagToast.hidden = false;
    clearTimeout(this._flagToastTimer);
    this._flagToastTimer = setTimeout(() => {
      flagToast.hidden = true;
    }, 4500);
  }

  toggleDrawer() {
    this._drawerOpen = !this._drawerOpen;
    if (this._drawerOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
    this._render();
  }

  _render(scoreDeltaText = '') {
    const currentMeta = STOP_NAMES[this._stopIndex - 1] || STOP_NAMES[0];
    const stopTitle = this._currentStop?.title || currentMeta.name;
    const locationName = currentMeta.zone;
    const flagCount = this._flags.length;

    // Clean connected step timeline
    const timelineHtml = STOP_NAMES.map((s, idx) => {
      const isCurrent = s.num === this._stopIndex;
      const isDone = this._completedStops.has(s.num) || s.num < this._stopIndex;
      
      let dotClass = 'pending';
      let content = s.num;
      if (isDone) {
        dotClass = 'completed';
        content = '✓';
      } else if (isCurrent) {
        dotClass = 'active';
      }

      return `
        <div class="timeline-node ${dotClass}">
          <span class="timeline-dot">${content}</span>
          <span class="timeline-text">${s.name}</span>
        </div>
        ${idx < STOP_NAMES.length - 1 ? `<div class="timeline-connector ${isDone ? 'done' : ''}"></div>` : ''}
      `;
    }).join('');

    // Audit drawer content
    const drawerHtml = this._drawerOpen ? `
      <div class="flags-audit-drawer">
        <div class="drawer-header">
          <span class="drawer-title">🚩 Real-Time Safety Audit Trail (${flagCount})</span>
          <button class="drawer-close-btn" id="close-flags-drawer">&times;</button>
        </div>
        <div class="drawer-content">
          ${this._flagHistory.length === 0 ? `
            <div class="drawer-empty">✓ No safety infractions logged. Operating compliantly.</div>
          ` : `
            <div class="flags-list">
              ${this._flagHistory.map(item => `
                <div class="flag-item">
                  <div class="flag-item-header">
                    <span class="flag-badge">INFRACTION</span>
                    <span class="flag-time">${item.time}</span>
                  </div>
                  <div class="flag-item-title">${item.flag.replace(/_/g, ' ').toUpperCase()}</div>
                  <div class="flag-item-location">${item.stopTitle}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    ` : '';

    this._el.innerHTML = `
      <nav class="nav-clean">
        <!-- 1. Left: Brand & Scenario Details -->
        <div class="nav-left">
          <span class="nav-title">Two Pairs of Eyes</span>
          <span class="nav-sep">/</span>
          <div class="nav-scenario-meta">
            <span class="scenario-name">Stop ${this._stopIndex}: ${stopTitle}</span>
            <span class="scenario-zone">${locationName}</span>
          </div>
        </div>

        <!-- 2. Center: Minimalist Step Timeline -->
        <div class="nav-center">
          <div class="timeline-track">
            ${timelineHtml}
          </div>
        </div>

        <!-- 3. Right: Real-Time Safety Flags & Score -->
        <div class="nav-right">
          <button class="flags-pill ${flagCount > 0 ? 'has-flags animate-pulse' : 'no-flags'}" id="flags-toggle-btn" title="View Safety Audit Trail">
            <span class="flags-icon">🚩</span>
            <span class="flags-count">${flagCount} ${flagCount === 1 ? 'FLAG' : 'FLAGS'}</span>
          </button>

          <div class="score-display">
            <span class="score-title">SCORE</span>
            <span class="score-num">${this._score}</span>
            <span class="score-denom">/ 25</span>
            ${scoreDeltaText ? `<span class="score-delta animate-pop ${scoreDeltaText.startsWith('-') ? 'negative' : 'positive'}">${scoreDeltaText}</span>` : ''}
          </div>
        </div>
      </nav>

      ${drawerHtml}
    `;

    // Bind drawer click events
    const toggleBtn = document.getElementById('flags-toggle-btn');
    if (toggleBtn) toggleBtn.onclick = () => this.toggleDrawer();

    const closeBtn = document.getElementById('close-flags-drawer');
    if (closeBtn) closeBtn.onclick = () => this.toggleDrawer();
  }
}
