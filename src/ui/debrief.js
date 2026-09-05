/**
 * Debrief.js
 * Gamified Zone-Wise Walk Debrief & Inspection Results.
 * Direct, visual breakdown of all 5 warehouse zones, Dave's verdict, and total score.
 */
import stopsData from '../data/stopsData.js';

const PASS_MARK = 18;

const ZONE_METADATA = {
  stop_01: {
    zoneNum: 'Zone 1',
    zoneName: 'Inbound Transit Area',
    hazardSummary: 'Hydraulic oil puddle on floor',
    icon: '🛢️'
  },
  stop_02: {
    zoneNum: 'Zone 2',
    zoneName: 'Forklift Blind Crossing',
    hazardSummary: 'Blind corner with active forklift',
    icon: '🚜'
  },
  stop_03: {
    zoneNum: 'Zone 3',
    zoneName: 'High-Bay Racking Aisle',
    hazardSummary: 'Damaged, bent structural upright',
    icon: '📦'
  },
  stop_04: {
    zoneNum: 'Zone 4',
    zoneName: 'Battery Charging Bay',
    hazardSummary: 'Overheated charger near boxes',
    icon: '⚡'
  },
  stop_05: {
    zoneNum: 'Zone 5',
    zoneName: 'Emergency Response Hub',
    hazardSummary: '5-station emergency readiness check',
    icon: '🚨'
  }
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
    let rankBadge = '⭐ SAFETY CHAMPION';
    let rankClass = 'rank-gold';
    let daveReaction = 'Awesome job, Alex! Walking these aisles with you really opened my eyes. We caught that bent rack, isolated the overheated charger, and verified all the emergency gear before anyone got hurt. Shift is in great hands!';

    if (!passed) {
      rankBadge = '⚠️ HAZARDS OVERLOOKED';
      rankClass = 'rank-red';
      daveReaction = 'Oof, Alex... we let some critical hazards slip by today. We were lucky this time, but ignoring bent racks or overheated chargers leads straight to real injuries. We have to stay sharper next walk.';
    } else if (total < 25) {
      rankBadge = '👍 SOLID INSPECTION';
      rankClass = 'rank-blue';
      daveReaction = 'Good work out there, Alex! You made some great calls and kept us safe. A couple of areas could have been secured even faster, but you proved that two pairs of eyes are always better than one!';
    }

    // Compounding incident alerts if any
    const consequenceHTML = this._deferredConsequences.length
      ? this._deferredConsequences.map(({ feedback }) => `
          <div class="game-incident-callout">
            <span class="callout-icon">💥</span>
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
      const meta = ZONE_METADATA[stop.id] || { zoneNum: stop.id, zoneName: stop.title, hazardSummary: '', icon: '📍' };
      const entry = logMap[stop.id] || { actionKey: 'continue_on', points: 5, outcome: 'optimal' };
      const actionDef = (stop.actions && stop.actions[entry.actionKey]) || {};
      const feedback = actionDef.feedback || stop.learning_objective || 'Zone inspected.';
      
      const outcomeTier = entry.outcome || 'optimal';
      const outcomeLabel = outcomeTier === 'optimal' ? 'OPTIMAL' : outcomeTier === 'partial' ? 'PARTIAL' : 'MISSED';
      const outcomeIcon = outcomeTier === 'optimal' ? '✅' : outcomeTier === 'partial' ? '⚠️' : '❌';
      const pointsStr = entry.points >= 0 ? `+${entry.points}` : `${entry.points}`;

      // Clean action name
      const actionTitle = entry.actionKey
        ? entry.actionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Action Taken';

      return `
        <div class="game-zone-strip card-${outcomeTier}">
          <div class="strip-left">
            <span class="strip-icon">${meta.icon}</span>
            <div class="strip-titles">
              <span class="strip-pill">${meta.zoneNum}</span>
              <strong class="strip-name">${meta.zoneName}</strong>
            </div>
          </div>

          <div class="strip-call">
            <span class="strip-lbl">ACTION:</span>
            <span class="strip-action-text">${actionTitle}</span>
          </div>

          <div class="strip-feedback" title="${feedback}">
            "${feedback}"
          </div>

          <div class="strip-outcome outcome-${outcomeTier}">
            ${outcomeIcon} <span class="strip-pts">${pointsStr} PTS</span>
          </div>
        </div>
      `;
    }).join('');

    this._el.innerHTML = `
      <div class="game-debrief-container">
        <!-- Top Header & Score Banner -->
        <div class="game-debrief-header">
          <div class="game-header-left">
            <div class="game-title-row">
              <span class="game-status-dot ${passed ? 'dot-pass' : 'dot-fail'}"></span>
              <h1 class="game-header-title">
                ${passed ? '🎉 Warehouse Safety Walk Complete!' : '⚠️ Safety Walk Needs Review'}
              </h1>
            </div>
            <p class="game-header-subtitle">
              All 5 warehouse zones inspected with Alex & Dave
            </p>
          </div>

          <div class="game-header-right">
            <div class="game-score-badge">
              <span class="score-large">${total}</span>
              <span class="score-total">/ 25</span>
              <span class="score-lbl">TOTAL SCORE</span>
            </div>
            <div class="game-rank-badge ${rankClass}">
              ${rankBadge}
            </div>
          </div>
        </div>

        ${consequenceHTML}

        <!-- Dave's Takeaway Speech Bubble (High-Visibility Supervisor Card) -->
        <div class="dave-perspective-card">
          <div class="dave-card-top">
            <div class="dave-profile">
              <div class="dave-avatar-circle">👷‍♂️</div>
              <div class="dave-profile-info">
                <span class="dave-name">Dave</span>
                <span class="dave-title">Warehouse Shift Supervisor</span>
              </div>
            </div>
            <div class="dave-mindset-pill ${rankClass}">
              ${passed ? '🤝 Safety Ally' : '⚠️ Complacent'}
            </div>
          </div>
          
          <div class="dave-speech-bubble">
            <div class="speech-quote-icon">“</div>
            <p class="dave-quote-full">${daveReaction}</p>
          </div>
        </div>

        <!-- Section Title: Zone-Wise Breakdown -->
        <div class="zone-section-header">
          <span class="section-title">📍 Zone-by-Zone Walk Report</span>
          <div class="tier-summary-chips">
            <span class="chip-item chip-opt">✅ ${tierCounts.optimal} Optimal</span>
            <span class="chip-item chip-par">⚠️ ${tierCounts.partial} Partial</span>
            <span class="chip-item chip-fai">❌ ${tierCounts.failure} Missed</span>
          </div>
        </div>

        <!-- All 5 Zone Strips List -->
        <div class="game-zones-list">
          ${zoneCardsHTML}
        </div>

        <!-- Footer Restart Bar -->
        <div class="game-debrief-footer">
          <div class="footer-tip">
            💡 <em>Two Pairs of Eyes: Stay alert, speak up, and never walk past a hazard.</em>
          </div>
          <button class="game-restart-btn" id="debrief-restart">
            🔄 Walk Again
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

