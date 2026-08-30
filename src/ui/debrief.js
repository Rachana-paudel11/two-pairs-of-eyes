// ── Debrief / Safety Report Module ──────────────────────────────────────────
// Manages the end-of-patrol scorecard modal, compliance grading, zone score breakdown, and restart flow.

let reportModal       = null;
let finalScoreEl      = null;
let gradeEl           = null;
let challengedEl      = null;
let feedbackEl        = null;
let normalizationEl   = null;
let zonesTableBody    = null;
let timestampEl       = null;
let btnRestart        = null;
let btnClose          = null;

const DEFAULT_STOPS = [
  { id: 'stop_01', title: 'Zone 01: Ground Fluid Spill', hazard: 'Fluid Spill Hazard' },
  { id: 'stop_02', title: 'Zone 02: Blind-Corner Junction', hazard: 'Forklift Conflict' },
  { id: 'stop_03', title: 'Zone 03: Racking Aisle B', hazard: 'Bent Rack Upright' },
  { id: 'stop_04', title: 'Zone 04: Battery Charging Bay', hazard: 'Combustibles Fire Risk' },
  { id: 'stop_05', title: 'Zone 05: Finished Goods Aisle', hazard: 'Clear Walkway Inspection' }
];

export function initDebrief({ onRestart, onFinish } = {}) {
  reportModal     = document.querySelector('#report-modal');
  finalScoreEl    = document.querySelector('#report-final-score');
  gradeEl         = document.querySelector('#report-grade');
  challengedEl    = document.querySelector('#report-challenged-count');
  feedbackEl      = document.querySelector('#report-feedback-text');
  normalizationEl = document.querySelector('#report-normalization-stat');
  zonesTableBody  = document.querySelector('#report-zones-table');
  timestampEl     = document.querySelector('#report-timestamp');
  btnRestart      = document.querySelector('#btn-restart-sim');
  btnClose        = document.querySelector('#btn-close-report');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      hideDebrief();
      if (onFinish) onFinish();
    });
  }

  if (btnRestart && onRestart) {
    btnRestart.addEventListener('click', () => {
      hideDebrief();
      onRestart();
    });
  }
}

export function formatActionTitle(key) {
  if (!key) return 'Bypassed / Not Evaluated';
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function showDebrief(payloadOrScore, roundResultsOrChallenges = [], totalChallengesArg = 0, maxScore = 25) {
  if (!reportModal) initDebrief();
  if (!reportModal) return;

  let score = 0;
  let roundResults = [];
  let totalChallenges = 0;

  if (typeof payloadOrScore === 'object' && payloadOrScore !== null) {
    score = payloadOrScore.total ?? 0;
    const tierCounts = payloadOrScore.tierCounts || { optimal: 0, partial: 0, neutral: 0, failure: 0 };
    totalChallenges = totalChallengesArg || (tierCounts.optimal + tierCounts.partial);
    roundResults = payloadOrScore.log || [];
  } else {
    score = Number(payloadOrScore) || 0;
    if (Array.isArray(roundResultsOrChallenges)) {
      roundResults = roundResultsOrChallenges;
      totalChallenges = totalChallengesArg || 0;
    } else {
      totalChallenges = Number(roundResultsOrChallenges) || 0;
    }
  }

  if (timestampEl) {
    const d = new Date();
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    timestampEl.textContent = formatted;
  }

  if (finalScoreEl) {
    finalScoreEl.innerHTML = `${score} <small style="font-size: 13px; font-weight: 600; opacity: 0.65;">/ ${maxScore} PTS</small>`;
  }
  if (challengedEl) {
    challengedEl.textContent = `${totalChallenges} of 5 Zones`;
  }

  if (gradeEl && normalizationEl) {
    if (score >= 20) {
      gradeEl.textContent = 'Level 1 (Exemplary H&S)';
      gradeEl.className = 'meta-val grade-a';
      normalizationEl.textContent = 'AUDIT PASSED';
      normalizationEl.className = 'meta-val outcome-badge-pass';
      if (feedbackEl) feedbackEl.textContent = 'Outstanding vigilance! You consistently prioritized official safety protocols over informal supervisor shortcuts, successfully stopping risks from normalizing.';
    } else if (score >= 10) {
      gradeEl.textContent = 'Level 2 (Competent)';
      gradeEl.className = 'meta-val warning';
      normalizationEl.textContent = 'CONDITIONAL PASS';
      normalizationEl.className = 'meta-val outcome-badge-warn';
      if (feedbackEl) feedbackEl.textContent = 'Good hazard awareness. You challenged several key hazards, but allowed some informal shortcuts to pass without formal logging.';
    } else {
      gradeEl.textContent = 'Level 3 (Action Required)';
      gradeEl.className = 'meta-val danger';
      normalizationEl.textContent = 'RE-AUDIT REQUIRED';
      normalizationEl.className = 'meta-val outcome-badge-danger';
      if (feedbackEl) feedbackEl.textContent = 'Caution: You accepted multiple unmitigated risks based on supervisor reassurance. In industrial environments, always challenge unsafe conditions.';
    }
  }

  // Populate Zone-by-Zone Breakdown Table
  if (zonesTableBody) {
    zonesTableBody.innerHTML = '';

    DEFAULT_STOPS.forEach((stopDef, idx) => {
      const result = Array.isArray(roundResults) 
        ? roundResults.find(r => r.stopId === stopDef.id) || roundResults[idx] 
        : null;
      const tr = document.createElement('tr');

      let actionText = result?.actionLabel || (result?.actionKey ? formatActionTitle(result.actionKey) : 'Bypassed');
      let points = typeof result?.points === 'number' ? result.points : 0;
      let outcome = result?.outcome || (points > 0 ? (points >= 5 ? 'optimal' : 'partial') : 'failure');

      let statusBadgeHtml = '';
      let scoreBadgeHtml = '';

      if (outcome === 'optimal') {
        statusBadgeHtml = `<span class="outcome-tag outcome-optimal">🟢 Optimal</span>`;
        scoreBadgeHtml = `<span class="score-delta delta-positive">+${points} PTS</span>`;
      } else if (outcome === 'partial') {
        statusBadgeHtml = `<span class="outcome-tag outcome-partial">🟡 Partial</span>`;
        scoreBadgeHtml = `<span class="score-delta delta-positive">+${points} PTS</span>`;
      } else {
        statusBadgeHtml = `<span class="outcome-tag outcome-failure">🔴 Failed</span>`;
        const penaltyStr = points <= 0 ? `${points}` : `-${points}`;
        scoreBadgeHtml = `<span class="score-delta delta-negative">${penaltyStr} PTS</span>`;
      }

      tr.innerHTML = `
        <td>
          <div class="zone-title">${stopDef.title}</div>
          <div class="zone-sub">${stopDef.hazard}</div>
        </td>
        <td><strong class="action-name">${actionText}</strong></td>
        <td>${statusBadgeHtml}</td>
        <td style="text-align: right;">${scoreBadgeHtml}</td>
      `;

      zonesTableBody.appendChild(tr);
    });
  }

  reportModal.style.display = 'flex';
}

export function hideDebrief() {
  if (reportModal) reportModal.style.display = 'none';
}

export function toggleDebrief(score, roundResults = [], totalChallenges = 0, maxScore = 25) {
  if (!reportModal) initDebrief();
  if (!reportModal) return;
  if (reportModal.style.display === 'flex') {
    hideDebrief();
  } else {
    showDebrief(score, roundResults, totalChallenges, maxScore);
  }
}
