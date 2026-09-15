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

export class FlagAlert {
  /**
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._popupEl = document.getElementById('flag-alert');
    this._logEl = document.getElementById('flag-log');
    this._raised = [];
    this._warned = new Set();
    this._open = false;
    this._timers = new Set();
    this._lastFeedback = '';

    if (!this._popupEl || !this._logEl) return;

    // action:resolved carries the stop's own consequence line and lands just
    // before the flag event, so the popup can quote the scenario's wording
    // rather than inventing its own.
    eventBus.on('action:resolved', ({ feedback = '' } = {}) => {
      this._lastFeedback = feedback;
    });

    eventBus.on('flags:updated', ({ stopId, newFlags = [] }) => {
      // One popup per hazard. The engine raises a flag once, but a replayed
      // stop or a doubled event must not stack popups or retrigger the cue.
      const unseen = newFlags.filter((flag) => !this._warned.has(`${stopId}:${flag}`));
      if (unseen.length === 0) return;

      for (const flag of unseen) {
        this._warned.add(`${stopId}:${flag}`);
        this._raised.push({ flag, stopId, ...copyFor(flag) });
      }
      this._showPopup(unseen.map(copyFor), this._lastFeedback);
    });

    // Moving on, or finishing, always clears the popup: it can never strand the
    // player behind a panel.
    eventBus.on('stop:entered', () => this._dismiss());
    eventBus.on('session:complete', () => {
      this._dismiss();
      this._open = false;
      this._logEl.hidden = true;
    });
  }

  // ── The popup ─────────────────────────────────────────────────────────────
  //
  // 0ms     cue starts, backdrop dims and blurs
  // 0ms     panel fades in from 95% scale, border pulses
  // 0-1200  flag gusts hard
  // 1200+   flag settles to idle flutter, panel stays up until dismissed
  _showPopup(entries, feedback) {
    this._clearTimers();

    const detail = entries.map((e) => e.detail).join(' ');

    this._popupEl.innerHTML = `
      <div class="hazard-popup" role="alertdialog" aria-labelledby="hazard-popup-title">
        ${this._flagSvg()}

        <div class="hazard-panel">
          <h2 class="hazard-title" id="hazard-popup-title">Hazard Ignored</h2>
          <p class="hazard-lead">You missed a safety hazard.</p>
          <p class="hazard-detail">${detail}</p>
          ${feedback ? `<div class="hazard-note"><p>${feedback}</p></div>` : ''}
          <button class="hazard-dismiss" type="button">Continue Patrol</button>
        </div>
      </div>
    `;

    this._popupEl.hidden = false;
    this._popupEl.classList.add('is-gusting');
    requestAnimationFrame(() => this._popupEl.classList.add('is-visible'));

    playFlagAlert();

    // Drop out of the hard gust into the idle flutter.
    this._defer(() => this._popupEl.classList.remove('is-gusting'), GUST_MS);

    this._popupEl
      .querySelector('.hazard-dismiss')
      .addEventListener('click', () => this._dismiss());
  }

  _dismiss() {
    if (this._popupEl.hidden) return;
    this._clearTimers();
    this._popupEl.classList.add('is-leaving');
    this._defer(() => {
      this._popupEl.hidden = true;
      this._popupEl.className = '';
      this._popupEl.innerHTML = '';
      // The counter only appears once the popup is out of the way, so the two
      // never compete for attention.
      this._renderLog();
    }, prefersReducedMotion() ? 0 : 260);
  }

  // ── The record ────────────────────────────────────────────────────────────
  _renderLog() {
    if (this._raised.length === 0) return;

    const count = this._raised.length;

    const items = this._raised
      .map(
        (item, i) => `
        <article class="flag-log-item">
          <header class="flag-log-item-head">
            <span class="flag-log-num">${String(i + 1).padStart(2, '0')}</span>
            <h3 class="flag-log-item-title">${item.title}</h3>
          </header>
          <p class="flag-log-why">${item.why}</p>
        </article>`
      )
      .join('');

    this._logEl.innerHTML = `
      <div class="flag-log-panel" ${this._open ? '' : 'hidden'}>
        <div class="flag-log-head">
          <span class="flag-log-title">Why you were flagged</span>
          <button class="flag-log-close" type="button" aria-label="Close flag list">&times;</button>
        </div>
        <div class="flag-log-items">${items}</div>
      </div>

      <button class="flag-log-btn ${this._open ? 'is-open' : ''}" type="button"
              aria-expanded="${this._open}"
              title="See why you were flagged">
        ${this._miniFlagSvg()}
        <span class="flag-log-count">${count}</span>
        <span class="flag-log-label">${count === 1 ? 'Flag' : 'Flags'}</span>
      </button>
    `;

    this._logEl.hidden = false;

    const btn = this._logEl.querySelector('.flag-log-btn');
    btn.addEventListener('click', () => {
      this._open = !this._open;
      this._renderLog();
    });

    this._logEl.querySelector('.flag-log-close').addEventListener('click', () => {
      this._open = false;
      this._renderLog();
    });

    if (!this._open) {
      btn.classList.add('is-bumped');
      this._defer(() => btn.classList.remove('is-bumped'), 700);
    }
  }

  // Every timer is tracked and self-removing, so a stop change mid-animation
  // cannot leave a stray callback pointing at a torn-down panel.
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
