/**
 * Debrief.js
 * High-End Gamified Walk Debrief Screen.
 * Exact implementation matching the design template:
 * - Status header with large badge, Total Score box, and Golden Safety Champion shield with laurel wreath.
 * - Supervisor Feedback Card featuring Dave's actual portrait image, badge, and quote.
 * - Tabular 4-column data grid (Zone | Action Taken | Your Response / Outcome | Score).
 * - Full color-coded zone icons and score badges (★ 5 / 5).
 * - High-impact footer with mission tip and green "WALK AGAIN" action button.
 */
import stopsData from '../data/stopsData.js';
import { DAVE_AVATAR_B64 } from './assets/daveAvatar.js';

const PASS_MARK = 18;

// SVGs for the Zone Favicon Boxes
const ZONE_ICONS = {
  stop_01: `
    <svg class="template-zone-svg icon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 20V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>
      <path d="M14 12v.01"/>
      <path d="M6 20h12"/>
      <path d="M15 10l4 2-4 2"/>
    </svg>
  `,
  stop_02: `
    <svg class="template-zone-svg icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 17h16M7 17v-4h6v4M13 13V6h3v7M3 17a2 2 0 104 0 2 2 0 00-4 0zm14 0a2 2 0 104 0 2 2 0 00-4 0zM19 17h2v-8h-3"/>
    </svg>
  `,
  stop_03: `
    <svg class="template-zone-svg icon-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
    </svg>
  `,
  stop_04: `
    <svg class="template-zone-svg icon-orange" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.5 2L3 13.5h7.5L8.5 22 21 10.5h-7.5L15.5 2z"/>
    </svg>
  `,
  stop_05: `
    <svg class="template-zone-svg icon-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      <path d="M2 8h2M20 8h2M12 2v2"/>
    </svg>
  `
};

// SVGs for Action Icons in Column 2
const ACTION_ICONS = {
  cordon_off: `
    <svg class="action-mini-svg col-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  `,
  hold_position: `
    <svg class="action-mini-svg col-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 14c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  `,
  isolate_and_report: `
    <svg class="action-mini-svg col-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `,
  emergency_drill: `
    <svg class="action-mini-svg col-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  `,
  continue_on: `
    <svg class="action-mini-svg col-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  `,
  report_only: `
    <svg class="action-mini-svg col-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  `,
  proceed_carefully: `
    <svg class="action-mini-svg col-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 19h20L12 2zm0 5v6m0 3v1"/>
    </svg>
  `,
    walk_straight_through: `
      <svg class="action-mini-svg col-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `,
    ignore: `
      <svg class="action-mini-svg col-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `
  };

  const ACTION_TITLES = {
    cordon_off:           'Cordon Off Area',
    report_only:          'Report Only',
    ignore:               'Ignore Hazard',
    hold_position:        'Hold Position & Alert',
    proceed_carefully:    'Proceed Carefully',
    walk_straight_through:'Walk Straight Through',
    isolate_and_report:   'Isolate & Report',
    emergency_drill:      'Inspect Emergency Hub',
    continue_on:          'Continue On'
  };

  const ZONE_METADATA = {
    stop_01: { zoneNum: 'ZONE 1', zoneName: 'Ground-Level Fluid Hazard' },
    stop_02: { zoneNum: 'ZONE 2', zoneName: 'Blind-Corner Forklift Traffic' },
    stop_03: { zoneNum: 'ZONE 3', zoneName: 'Bent Pallet Rack Upright' },
    stop_04: { zoneNum: 'ZONE 4', zoneName: 'Battery Charging Bay Warning Light' },
    stop_05: { zoneNum: 'ZONE 5', zoneName: 'Clear Aisle & Emergency Hub' }
  };

export class Debrief {
  /**
   * @param {object} eventBus
   */
  constructor(eventBus) {
    this._el = document.getElementById('debrief');
    this._deferredConsequences = [];

    eventBus.on('consequence:play', ({ deferred, consequence, feedback }) => {
      if (deferred) {
        this._deferredConsequences.push({ consequence, feedback });
      }
    });

    eventBus.on('session:complete', (data) => {
      this._data = data;
      this._render();
    });
  }

  _render() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const { total, tierCounts, log, flags, triggeredRules } = this._data;
    const passed = total >= PASS_MARK && tierCounts.failure === 0;

    // Rank & Dave's Reaction
    let rankTitle = 'SAFETY CHAMPION';
    let rankSubtitle = 'Outstanding awareness. Keep leading the way!';
    let rankClass = 'shield-gold';
    let daveReaction = '“Awesome job, Alex! Walking these aisles with you proved how two pairs of eyes catch what one person misses. We secured that spill, held at the blind corner, caught that bent upright, and isolated the charger. Great leadership!”';

    if (!passed) {
      rankTitle = 'HAZARDS OVERLOOKED';
      rankSubtitle = 'Safety critical hazards bypassed during patrol.';
      rankClass = 'shield-red';
      daveReaction = '“We let some critical hazards slip past us today, Alex. Overlooking bent racks or overheating chargers leads straight to workplace injuries. Let’s stay sharper next walk.”';
    } else if (total < 25) {
      rankTitle = 'SOLID INSPECTION';
      rankSubtitle = 'Good standard maintained across the facility.';
      rankClass = 'shield-blue';
      daveReaction = '“Good work out there, Alex! You made solid calls and kept the facility safe. Stay sharp, speak up, and keep leading by example!”';
    }

    // Compounding incident alerts if any
    const consequenceHTML = this._deferredConsequences.length
      ? this._deferredConsequences.map(({ feedback }) => `
          <div class="template-incident-alert">
            <div><strong>Incident Escalation:</strong> ${feedback}</div>
          </div>
        `).join('')
      : '';

    // Zone Breakdown Cards
    const logMap = {};
    if (Array.isArray(log)) {
      log.forEach(entry => { logMap[entry.stopId] = entry; });
    }

    const zoneCardsHTML = stopsData.stops.map(stop => {
      const meta = ZONE_METADATA[stop.id] || { zoneNum: stop.id.toUpperCase(), zoneName: stop.title };
      const iconSvg = ZONE_ICONS[stop.id] || ZONE_ICONS.stop_01;
      const entry = logMap[stop.id] || { actionKey: 'emergency_drill', points: 5, outcome: 'optimal' };
      const actionDef = (stop.actions && stop.actions[entry.actionKey]) || {};
      const feedback = actionDef.feedback || stop.learning_objective || 'Zone inspected.';
      
      const outcomeTier = entry.outcome || 'optimal';
      const pointsObtained = entry.points !== undefined ? entry.points : 0;
      const maxPts = 5;

      const actionTitle = ACTION_TITLES[entry.actionKey] || (entry.actionKey
        ? entry.actionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Action Taken');

      const actionIconSvg = ACTION_ICONS[entry.actionKey] || ACTION_ICONS.continue_on;

      return `
        <div class="template-row card-${outcomeTier}">
          <!-- Col 1: Zone -->
          <div class="t-col-zone">
            <div class="t-zone-box">${iconSvg}</div>
            <div class="t-zone-info">
              <span class="t-zone-tag">${meta.zoneNum}</span>
              <strong class="t-zone-name">${meta.zoneName}</strong>
            </div>
          </div>

          <!-- Col 2: Action Taken -->
          <div class="t-col-action">
            <div class="t-action-box">${actionIconSvg}</div>
            <div class="t-action-info">
              <span class="t-action-lbl">ACTION:</span>
              <strong class="t-action-val">${actionTitle}</strong>
            </div>
          </div>

          <!-- Col 3: Outcome / Feedback -->
          <div class="t-col-outcome" title="${feedback}">
            <span class="t-outcome-text">“${feedback}”</span>
          </div>

          <!-- Col 4: Score -->
          <div class="t-col-score">
            <div class="t-score-pill pill-${outcomeTier}">
              <span class="t-star">${outcomeTier === 'failure' ? '⚠' : (outcomeTier === 'partial' ? '!' : '★')}</span>
              <strong class="t-pts">${pointsObtained > 0 ? `+${pointsObtained}` : pointsObtained} / ${maxPts}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this._el.innerHTML = `
      <div class="template-debrief-modal">
        <!-- 1. Header Banner -->
        <div class="template-header">
          <!-- Left: Title Block -->
          <div class="header-status-group">
            <div class="header-title-block">
              <h1 class="header-title-top">WAREHOUSE SAFETY WALK</h1>
              <h2 class="header-title-bottom ${passed ? 'text-green' : 'text-red'}">
                ${passed ? 'COMPLETE' : 'NEEDS REVIEW'}
              </h2>
              <p class="header-subtitle">All 5 warehouse zones inspected with Alex and Dave.</p>
            </div>
          </div>

          <!-- Center: Total Score Box -->
          <div class="header-score-box">
            <div class="score-number-row">
              <span class="score-big ${total < 0 ? 'text-red' : ''}">${total}</span>
              <span class="score-max">/ 25</span>
            </div>
            <span class="score-tag">TOTAL SCORE</span>
          </div>

          <!-- Right: Golden Shield Laurel Badge -->
          <div class="header-shield-badge ${rankClass}">
            <div class="shield-laurel-wrap">
              <svg class="laurel-wreath-svg" viewBox="0 0 48 48" fill="currentColor">
                <path d="M24 4L12 9v13c0 8.84 5.12 17.11 12 19 6.88-1.89 12-10.16 12-19V9L24 4zm0 6l2.35 4.76 5.26.77-3.8 3.71.9 5.24L24 22.01l-4.71 2.47.9-5.24-3.8-3.71 5.26-.77L24 10z"/>
                <path d="M8 20c-1.5 4 0 9 3 12M40 20c1.5 4 0 9-3 12" stroke="currentColor" stroke-width="2" fill="none"/>
              </svg>
            </div>
            <div class="shield-text-block">
              <strong class="shield-title">${rankTitle}</strong>
              <p class="shield-desc">${rankSubtitle}</p>
            </div>
          </div>
        </div>

        ${consequenceHTML}

        <!-- 2. Dave Supervisor Feedback Card -->
        <div class="template-dave-card">
          <div class="dave-card-left">
            <div class="dave-portrait-frame">
              <img src="${DAVE_AVATAR_B64}" class="dave-portrait-img" alt="Supervisor Dave" />
            </div>
            <div class="dave-meta-info">
              <strong class="dave-heading-name">Dave</strong>
              <span class="dave-job-title">WAREHOUSE SHIFT SUPERVISOR</span>
              <div class="dave-ally-pill">
                <span>${passed ? 'Safety Ally' : 'Complacent'}</span>
              </div>
            </div>
          </div>

          <div class="dave-card-right">
            <div class="dave-speech-col">
              <div class="dave-feedback-header">
                <svg class="chat-feedback-svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                <span>SUPERVISOR FEEDBACK</span>
              </div>
              <p class="dave-speech-text">${daveReaction}</p>
            </div>
            <div class="dave-signature-col">
              <div class="dave-signature-box">
                <div class="dave-signature-art">
                  <span class="dave-signature-script">Dave Miller</span>
                  <svg class="dave-sig-flourish" viewBox="0 0 110 20" fill="none">
                    <path d="M4 14 C 28 8, 70 18, 106 10" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="dave-signature-meta">
                  <span class="dave-sig-line"></span>
                  <span class="dave-sig-txt">SHIFT SUPERVISOR SIGN-OFF</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Zone-By-Zone Walk Report Section -->
        <div class="template-table-section">
          <!-- Section Header Bar -->
          <div class="table-section-header">
            <div class="table-title-group">
              <svg class="table-icon-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              <h3 class="table-section-title">ZONE-BY-ZONE WALK REPORT</h3>
            </div>

            <div class="table-legend-group">
              <span class="legend-chip chip-opt">
                <span class="legend-dot-opt">✔</span> Optimal (+5 pts)
              </span>
              <span class="legend-chip chip-par">
                <span class="legend-dot-par">!</span> Partial (+3 pts)
              </span>
              <span class="legend-chip chip-fai">
                <span class="legend-dot-fai">✖</span> Risk / Hazard (-3 pts)
              </span>
            </div>
          </div>

          <!-- Table Columns Header -->
          <div class="template-columns-header">
            <span class="col-head col-h-zone">ZONE</span>
            <span class="col-head col-h-action">ACTION TAKEN</span>
            <span class="col-head col-h-outcome">YOUR RESPONSE / OUTCOME</span>
            <span class="col-head col-h-score">SCORE</span>
          </div>

          <!-- Table Rows List -->
          <div class="template-rows-list">
            ${zoneCardsHTML}
          </div>
        </div>

        <!-- 4. Footer Bar -->
        <div class="template-footer">
          <div class="footer-hint-box">
            <div class="hint-lightbulb-circle">
              <svg class="lightbulb-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
              </svg>
            </div>
            <span class="hint-text">
              <strong class="hint-highlight">Two Pairs of Eyes:</strong> Stay alert, speak up, and never walk past a hazard.
            </span>
          </div>

          <button class="template-walk-again-btn" id="debrief-restart" aria-label="Walk Again">
            <svg class="reload-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>WALK AGAIN</span>
          </button>
        </div>
      </div>
    `;

    this._el.removeAttribute('hidden');

    document.getElementById('debrief-restart').addEventListener('click', () => {
      window.location.reload();
    });
  }
}
