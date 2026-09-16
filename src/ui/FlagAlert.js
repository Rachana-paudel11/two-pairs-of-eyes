/**
 * FlagAlert.js
 *
 * The "Hazard Ignored" consequence popup, plus the flag record it leaves behind.
 *
 *  POPUP  — raised when the trainee's choice actually misses a hazard (the
 *           engine only raises a flag on a genuine miss, so that event is the
 *           trigger rather than the Ignore button itself: walking straight
 *           through a forklift lane is the same mistake by another name).
 *           A single warning flag is planted in the top of a chamfered glass
 *           panel, gusts hard for ~1.2s, then settles to an idle flutter. The
 *           panel stays up — the warehouse stays visible and playable behind it.
 *
 *  RECORD — dismissing the popup leaves a flag counter bottom-left. Opening it
 *           explains why each flag was raised.
 */

import { playFlagAlert } from '../utils/audio.js';

// Plain-English copy for the flags stops.json can raise. Anything missing
// falls back to a de-slugged id, so a new flag still renders without a change.
const FLAG_COPY = {
  ignored_ground_hazard: {
    title: 'Ground Hazard Ignored',
    detail: 'A slip hazard was left unsecured for the next person through.',
    why: 'You walked past the spill instead of securing it. A fluid spill on a transit line is a slip risk for everyone who comes after you — it needed cordoning off immediately.',
  },
  near_miss_forklift: {
    title: 'Forklift Near Miss',
    detail: 'You crossed a live route without making contact with the operator.',
    why: 'You stepped into a vehicle transit lane without eye contact. A forklift driver on a blind corner cannot confirm you have been seen — you must stop and make contact before crossing.',
  },
  ignored_bent_rack: {
    title: 'Structural Damage Ignored',
    detail: 'Damaged racking was left in service, still carrying load.',
    why: 'You left a bent upright carrying load. Racking damage does not become safe just because it has held so far — it needed isolating and reporting, however long it had been like that.',
  },
  ignored_charging_warning: {
    title: 'Charging Warning Ignored',
    detail: 'An early warning on the charging bay was left unaddressed.',
    why: 'You treated an overheating charger as a later problem. Early warning indicators on battery charging are the point at which it is still safe to act — power needed isolating there and then.',
  },
};

// How long the flag is driven hard before dropping to its idle flutter.
const GUST_MS = 1200;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function copyFor(flag) {
  return (
    FLAG_COPY[flag] || {
      title: flag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: 'A safety violation has been recorded against this patrol.',
      why: 'This action was logged against your patrol record.',
    }
  );
}

// Deep, stop-specific critical safety analysis for decisions made at each stop
const CRITICAL_STOP_ANALYSIS = {
  stop_01: {
    title: 'Spill Left Unsecured',
    badge: 'STOP 01',
    analysis: 'Bypassed active chemical spill on pedestrian transit walkway.',
  },
  stop_02: {
    title: 'Blind Crossing Violation',
    badge: 'STOP 02',
    analysis: 'Crossed forklift transit route without operator visual contact.',
  },
  stop_03: {
    title: 'Racking Defect Ignored',
    badge: 'STOP 03',
    analysis: 'Deformed load-bearing upright left in service under load.',
  },
  stop_04: {
    title: 'Thermal Hazard Ignored',
    badge: 'STOP 04',
    analysis: 'Overheating battery charger left connected to live power.',
  },
  stop_05: {
    title: 'Life-Safety Audit Skipped',
    badge: 'STOP 05',
    analysis: 'Concluded walk without verifying emergency station readiness.',
  },
};

export class FlagAlert {
  /**
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._popupEl = document.getElementById('flag-alert');
    this._logEl = document.getElementById('flag-log');

    // Create persistent screen-edge red warning border overlay if not present
    this._borderEl = document.getElementById('hazard-screen-border');
    if (!this._borderEl) {
      this._borderEl = document.createElement('div');
      this._borderEl.id = 'hazard-screen-border';
      this._borderEl.className = 'hazard-screen-border';
      this._borderEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this._borderEl);
    }

    this._raised = [];
    this._warned = new Set();
    this._open = false;
    this._timers = new Set();
    this._lastFeedback = '';
    this._currentStopId = 'stop_01';
    this._activeLogIndex = 0;
    this._hasStarted = false;

    if (!this._popupEl || !this._logEl) return;

    // Start with flag meter hidden until simulation starts
    this._renderLog();

    eventBus.on('action:resolved', ({ stopId, feedback = '' } = {}) => {
      this._lastFeedback = feedback;
      if (stopId) this._currentStopId = stopId;
    });

    eventBus.on('flags:updated', ({ stopId, newFlags = [] }) => {
      this._hasStarted = true;
      const activeStop = stopId || this._currentStopId;
      const unseen = newFlags.filter((flag) => !this._warned.has(`${activeStop}:${flag}`));
      if (unseen.length === 0) return;

      for (const flag of unseen) {
        this._warned.add(`${activeStop}:${flag}`);
        this._raised.push({ flag, stopId: activeStop, ...copyFor(flag) });
      }

      // Auto-focus latest flag in swappable record
      this._activeLogIndex = this._raised.length - 1;

      // 1. Immediately increment the persistent flag meter (0 -> 1)
      this._renderLog();
      const btn = this._logEl.querySelector('.flag-log-btn');
      if (btn) {
        btn.classList.add('is-bumped');
        this._defer(() => btn.classList.remove('is-bumped'), 1200);
      }

      // 2. Activate the thin bright red border across all 4 screen edges
      this._activateScreenBorder();

      // 3. Display the small top-left decision pop-up
      this._showDecisionPopup(activeStop, unseen, this._lastFeedback);
    });

    // When patrol starts or advances to next stop, unhide meter and dismiss popups
    eventBus.on('stop:entered', ({ stop } = {}) => {
      this._hasStarted = true;
      if (stop && stop.id) this._currentStopId = stop.id;
      this._dismiss();
      this._renderLog();
    });

    eventBus.on('session:complete', () => {
      this._dismiss();
      this._open = false;
      this._deactivateScreenBorder();
    });
  }

  _activateScreenBorder() {
    if (this._borderEl) {
      this._borderEl.classList.add('is-active');
    }
  }

  _deactivateScreenBorder() {
    if (this._borderEl) {
      this._borderEl.classList.remove('is-active');
    }
  }

  // ── Top-Left Compact Decision Popup ──────────────────────────────────────
  _showDecisionPopup(stopId, entries, feedback) {
    this._clearTimers();

    const analysis = CRITICAL_STOP_ANALYSIS[stopId] || {
      title: 'Safety Hazard Ignored',
      badge: 'SAFETY ALERT',
      analysis: entries[0]?.detail || feedback || 'A critical safety control was bypassed.',
    };

    this._popupEl.innerHTML = `
      <div class="decision-popup-card is-compact" role="alert" aria-live="assertive">
        <div class="decision-card-edge"></div>
        <div class="decision-card-content">
          <header class="decision-card-head">
            <div class="decision-badge-wrap">
              <span class="decision-warning-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <span class="decision-badge">${analysis.badge}</span>
            </div>
            <div class="decision-card-actions">
              <span class="decision-flag-chip">+1 FLAG</span>
              <button class="decision-card-close" type="button" aria-label="Dismiss">&times;</button>
            </div>
          </header>

          <h4 class="decision-card-title">${analysis.title}</h4>
          <p class="decision-analysis-text">${analysis.analysis}</p>
        </div>
      </div>
    `;

    this._popupEl.hidden = false;
    this._popupEl.classList.remove('is-leaving');
    this._popupEl.classList.add('is-visible');

    playFlagAlert();

    const closeBtn = this._popupEl.querySelector('.decision-card-close');
    const onDismiss = () => this._dismiss();

    if (closeBtn) closeBtn.addEventListener('click', onDismiss);

    // Auto-dismiss after 7 seconds
    this._defer(onDismiss, 7000);

    // Swipe to dismiss
    let touchStartX = 0;
    let touchStartY = 0;
    this._popupEl.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    this._popupEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dx < -30 || dy < -30) onDismiss();
    }, { passive: true });
  }

  _dismiss() {
    if (this._popupEl.hidden) return;
    this._clearTimers();
    this._popupEl.classList.add('is-leaving');
    this._deactivateScreenBorder();
    this._defer(() => {
      this._popupEl.hidden = true;
      this._popupEl.className = '';
      this._popupEl.innerHTML = '';
    }, prefersReducedMotion() ? 0 : 260);
  }

  // ── Persistent & Swappable Flag Meter (Bottom-Left) ─────────────────────────
  _renderLog() {
    const count = this._raised.length;
    const isZero = count === 0;

    if (this._activeLogIndex >= count) {
      this._activeLogIndex = Math.max(0, count - 1);
    }

    let swapperNav = '';
    let cardContent = '';

    if (isZero) {
      cardContent = `<div class="flag-log-empty"><p>No safety flags recorded. All hazards identified &amp; secured!</p></div>`;
    } else {
      const current = this._raised[this._activeLogIndex] || this._raised[0];

      if (count > 1) {
        swapperNav = `
          <div class="flag-log-swapper-bar">
            <button class="flag-swap-arrow flag-swap-prev" type="button" aria-label="Previous flag" ${this._activeLogIndex === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="flag-log-pills">
              ${this._raised.map((_, i) => `
                <button class="flag-pill-btn ${i === this._activeLogIndex ? 'is-active' : ''}" data-idx="${i}" type="button" aria-label="Flag ${i + 1}">
                  ${String(i + 1).padStart(2, '0')}
                </button>
              `).join('')}
            </div>
            <button class="flag-swap-arrow flag-swap-next" type="button" aria-label="Next flag" ${this._activeLogIndex === count - 1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        `;
      }

      cardContent = `
        <article class="flag-log-card" data-index="${this._activeLogIndex}">
          <header class="flag-log-item-head">
            <span class="flag-log-num">${String(this._activeLogIndex + 1).padStart(2, '0')}</span>
            <h4 class="flag-log-item-title">${current.title}</h4>
          </header>
          <p class="flag-log-why">${current.why}</p>
        </article>
      `;
    }

    this._logEl.innerHTML = `
      <div class="flag-log-panel is-swappable" ${this._open ? '' : 'hidden'}>
        <div class="flag-log-head">
          <div class="flag-log-head-title-wrap">
            <span class="flag-log-title">Flag Record (${count})</span>
            ${count > 1 ? `<span class="flag-log-counter">${this._activeLogIndex + 1} of ${count}</span>` : ''}
          </div>
          <button class="flag-log-close" type="button" aria-label="Close flag list">&times;</button>
        </div>
        ${swapperNav}
        <div class="flag-log-swipe-container">${cardContent}</div>
      </div>

      <button class="flag-log-btn ${this._open ? 'is-open' : ''} ${isZero ? 'is-zero' : 'has-flags'}" type="button"
              aria-expanded="${this._open}"
              title="${isZero ? 'No safety flags recorded' : 'See why you were flagged'}">
        ${this._miniFlagSvg()}
        <span class="flag-log-count">${count}</span>
        <span class="flag-log-label">${count === 1 ? 'Flag' : 'Flags'}</span>
      </button>
    `;

    this._logEl.hidden = !this._hasStarted;

    const btn = this._logEl.querySelector('.flag-log-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this._open = !this._open;
        this._renderLog();
      });
    }

    const closeBtn = this._logEl.querySelector('.flag-log-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this._open = false;
        this._renderLog();
      });
    }

    // Swapper controls
    const prevBtn = this._logEl.querySelector('.flag-swap-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this._activeLogIndex > 0) {
          this._activeLogIndex--;
          this._renderLog();
        }
      });
    }

    const nextBtn = this._logEl.querySelector('.flag-swap-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this._activeLogIndex < count - 1) {
          this._activeLogIndex++;
          this._renderLog();
        }
      });
    }

    const pills = this._logEl.querySelectorAll('.flag-pill-btn');
    pills.forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && idx !== this._activeLogIndex) {
          this._activeLogIndex = idx;
          this._renderLog();
        }
      });
    });

    // Swipe gesture on card container
    const swipeBox = this._logEl.querySelector('.flag-log-swipe-container');
    if (swipeBox && count > 1) {
      let touchStartX = 0;
      swipeBox.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      swipeBox.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -35 && this._activeLogIndex < count - 1) {
          this._activeLogIndex++;
          this._renderLog();
        } else if (dx > 35 && this._activeLogIndex > 0) {
          this._activeLogIndex--;
          this._renderLog();
        }
      }, { passive: true });
    }
  }

  _defer(fn, ms) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, ms);
    this._timers.add(id);
    return id;
  }

  _clearTimers() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
  }

  // ── Artwork ───────────────────────────────────────────────────────────────

  // One flag planted in the top of the panel.
  //
  // The 3D read is faked, not modelled: the cloth carries a banded gradient
  // whose light and dark stops sit where the wave's crests and troughs are, a
  // vertical shade for the droop, and drawn fold lines over the top. That is
  // what separates it from a flat silhouette — a single fill reads as a sticker.
  // Cloth, pole and socket stay separate groups so each can move differently.
  _flagSvg() {
    return `
      <svg class="hazard-flag" viewBox="0 0 250 250" aria-hidden="true">
        <defs>
          <!-- Light and dark bands = the crests and troughs of the wave. -->
          <linearGradient id="hazardCloth" x1="0" y1="0" x2="1" y2="0.25">
            <stop offset="0%"   stop-color="#7d0b12" />
            <stop offset="10%"  stop-color="#bd1119" />
            <stop offset="25%"  stop-color="#ee2129" />
            <stop offset="39%"  stop-color="#c9131c" />
            <stop offset="53%"  stop-color="#830c13" />
            <stop offset="68%"  stop-color="#d5161f" />
            <stop offset="84%"  stop-color="#f22a32" />
            <stop offset="100%" stop-color="#8e0d14" />
          </linearGradient>

          <!-- Droop: the lower edge falls into shadow. -->
          <linearGradient id="hazardClothShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#fff" stop-opacity="0.07" />
            <stop offset="38%"  stop-color="#fff" stop-opacity="0" />
            <stop offset="100%" stop-color="#2b0306" stop-opacity="0.5" />
          </linearGradient>

          <!-- Chrome: dark edge, specular core, dark edge. -->
          <linearGradient id="hazardPole" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="#4c525c" />
            <stop offset="28%"  stop-color="#d9e0e8" />
            <stop offset="46%"  stop-color="#ffffff" />
            <stop offset="68%"  stop-color="#9aa3af" />
            <stop offset="100%" stop-color="#454b54" />
          </linearGradient>

          <radialGradient id="hazardFinial" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0%"   stop-color="#ffffff" />
            <stop offset="55%"  stop-color="#d3dae2" />
            <stop offset="100%" stop-color="#6d7581" />
          </radialGradient>

          <filter id="hazardBloom" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <ellipse class="hazard-flag-socket" cx="101" cy="236" rx="66" ry="14" />

        <g class="hazard-flag-sway">
          <!-- Pole drawn as a tapered solid so it can take the chrome gradient;
               a stroke could only ever be one flat colour. -->
          <path class="hazard-flag-pole" d="M96 240 L105 240 L120 24 L111 24 Z" />
          <circle class="hazard-flag-finial" cx="116" cy="17" r="11" />

          <g class="hazard-flag-cloth-group">
            <!-- Bloom sits behind the cloth, same silhouette, heavily blurred. -->
            <path class="hazard-flag-bloom"
                  d="M117 26 C 151 6, 187 46, 219 22 C 231 13, 243 22, 249 32
                     C 240 74, 233 113, 230 156 C 213 139, 195 130, 175 142
                     C 145 160, 126 135, 102 148 Z" />
            <path class="hazard-flag-cloth"
                  d="M117 26 C 151 6, 187 46, 219 22 C 231 13, 243 22, 249 32
                     C 240 74, 233 113, 230 156 C 213 139, 195 130, 175 142
                     C 145 160, 126 135, 102 148 Z" />
            <path class="hazard-flag-shade"
                  d="M117 26 C 151 6, 187 46, 219 22 C 231 13, 243 22, 249 32
                     C 240 74, 233 113, 230 156 C 213 139, 195 130, 175 142
                     C 145 160, 126 135, 102 148 Z" />
            <path class="hazard-flag-curl"
                  d="M175 142 C 195 130, 213 139, 230 156
                     C 211 150, 193 147, 174 148 Z" />
            <g class="hazard-flag-folds">
              <path d="M124 44 C 156 28, 188 58, 224 42" />
              <path d="M120 74 C 152 58, 184 88, 222 72" />
              <path d="M115 104 C 148 89, 180 118, 219 102" />
              <path d="M110 131 C 144 117, 176 145, 216 130" />
            </g>
          </g>
        </g>
      </svg>`;
  }

  _miniFlagSvg() {
    return `
      <svg class="flag-mini-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path class="flag-mini-pole" d="M5 3 L5 21" />
        <path class="flag-mini-cloth" d="M5 4 C 10 1, 15 7, 20 4 L20 13 C 15 16, 10 10, 5 13 Z" />
      </svg>`;
  }
}
