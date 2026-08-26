// ── Debrief / Safety Report Module ──────────────────────────────────────────
// Manages the end-of-patrol scorecard modal, compliance grading, zone score breakdown, and restart flow.

<<<<<<< HEAD
let reportModal       = null;
let finalScoreEl      = null;
let gradeEl           = null;
let challengedEl      = null;
let feedbackEl        = null;
let normalizationEl   = null;
let zonesTableBody    = null;
let btnRestart        = null;
let btnClose          = null;

const DEFAULT_STOPS = [
  { id: 'stop_01', title: 'Zone 01: Ground Fluid Spill', hazard: 'Fluid Spill Hazard' },
  { id: 'stop_02', title: 'Zone 02: Blind-Corner Junction', hazard: 'Forklift Conflict' },
  { id: 'stop_03', title: 'Zone 03: Racking Aisle B', hazard: 'Bent Rack Upright' },
  { id: 'stop_04', title: 'Zone 04: Battery Charging Bay', hazard: 'Combustibles Fire Risk' },
  { id: 'stop_05', title: 'Zone 05: Finished Goods Aisle', hazard: 'Clear Walkway Inspection' }
];

let timestampEl     = null;

export function initDebrief({ onRestart, onFinish } = {}) {
=======
let reportModal      = null;
let finalScoreEl     = null;
let gradeEl          = null;
let challengedEl     = null;
let feedbackEl       = null;
let normalizationEl  = null;
let btnRestart       = null;
let btnClose         = null;

export function initDebrief({ onRestart } = {}) {
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  reportModal     = document.querySelector('#report-modal');
  finalScoreEl    = document.querySelector('#report-final-score');
  gradeEl         = document.querySelector('#report-grade');
  challengedEl    = document.querySelector('#report-challenged-count');
  feedbackEl      = document.querySelector('#report-feedback-text');
  normalizationEl = document.querySelector('#report-normalization-stat');
<<<<<<< HEAD
  zonesTableBody  = document.querySelector('#report-zones-table');
  timestampEl     = document.querySelector('#report-timestamp');
=======
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
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

<<<<<<< HEAD
export function formatActionTitle(key) {
  if (!key) return 'Bypassed / Not Evaluated';
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function showDebrief(score, roundResults = [], totalChallenges = 0, maxScore = 25) {
  if (!reportModal) initDebrief();
  if (!reportModal) return;

  if (timestampEl) {
    const d = new Date();
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    timestampEl.textContent = formatted;
  }

  if (finalScoreEl) finalScoreEl.innerHTML = `${score} <small style="font-size: 13px; font-weight: 600; opacity: 0.65;">/ ${maxScore} PTS</small>`;
  if (challengedEl) challengedEl.textContent = `${totalChallenges} of 5`;

  if (gradeEl && feedbackEl && normalizationEl) {
    if (score >= 20) {
      gradeEl.textContent = 'Level 1 (Exemplary H&S)';
      gradeEl.className = 'meta-val grade-a';
      normalizationEl.textContent = 'AUDIT PASSED';
      normalizationEl.className = 'meta-val outcome-badge-pass';
      feedbackEl.textContent = 'Outstanding vigilance! You consistently prioritized official safety protocols over informal supervisor shortcuts, successfully stopping risks from normalizing.';
    } else if (score >= 10) {
      gradeEl.textContent = 'Level 2 (Competent)';
      gradeEl.className = 'meta-val warning';
      normalizationEl.textContent = 'CONDITIONAL PASS';
      normalizationEl.className = 'meta-val outcome-badge-warn';
      feedbackEl.textContent = 'Good hazard awareness. You challenged several key hazards, but allowed some informal shortcuts to pass without formal logging.';
    } else {
      gradeEl.textContent = 'Level 3 (Action Required)';
      gradeEl.className = 'meta-val danger';
      normalizationEl.textContent = 'RE-AUDIT REQUIRED';
      normalizationEl.className = 'meta-val outcome-badge-danger';
      feedbackEl.textContent = 'Caution: You accepted multiple unmitigated risks based on supervisor reassurance. In industrial environments, always challenge unsafe conditions.';
    }
  }

  // Populate Zone-by-Zone Breakdown Table
  if (zonesTableBody) {
    zonesTableBody.innerHTML = '';

    DEFAULT_STOPS.forEach((stopDef, idx) => {
      const result = Array.isArray(roundResults) ? roundResults.find(r => r.stopId === stopDef.id) || roundResults[idx] : null;
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
        const penaltyStr = points < 0 ? `${points}` : `${points}`;
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
=======
export function showDebrief(payload, totalChallenges = 0, maxScore = 25) {
  if (!reportModal) initDebrief();
  if (!reportModal) return;

  const score = typeof payload === 'number' ? payload : (payload?.total ?? 0);
  const log = Array.isArray(payload?.log) ? payload.log : [];
  const tierCounts = payload?.tierCounts || { optimal: 0, partial: 0, neutral: 0, failure: 0 };
  const triggeredRules = Array.isArray(payload?.triggeredRules) ? payload.triggeredRules : [];
  const flags = Array.isArray(payload?.flags) ? payload.flags : [];

  if (finalScoreEl) finalScoreEl.textContent = `${score} / ${maxScore}`;
  if (challengedEl) challengedEl.textContent = `${totalChallenges || tierCounts.optimal + tierCounts.partial} of 5`;

  if (normalizationEl) {
    if (tierCounts.failure === 0) {
      normalizationEl.textContent = 'Overcome';
      normalizationEl.className = 'stat-val success';
    } else if (tierCounts.failure === 1) {
      normalizationEl.textContent = 'Partial Risk';
      normalizationEl.className = 'stat-val warning';
    } else {
      normalizationEl.textContent = 'High Bias';
      normalizationEl.className = 'stat-val danger';
    }
  }

  if (gradeEl) {
    if (score >= 20) {
      gradeEl.textContent = 'Level 1 (Exemplary H&S)';
      gradeEl.className = 'stat-val grade-a';
    } else if (score >= 10) {
      gradeEl.textContent = 'Level 2 (Competent)';
      gradeEl.className = 'stat-val primary';
    } else {
      gradeEl.textContent = 'Level 3 (Action Required)';
      gradeEl.className = 'stat-val';
    }
  }

  if (feedbackEl) {
    let mainFeedback = '';
    if (score >= 20) {
      mainFeedback = 'Outstanding vigilance! You consistently prioritized official safety protocols over informal supervisor shortcuts, successfully preventing risk normalization.';
    } else if (score >= 10) {
      mainFeedback = 'Good overall hazard awareness. You challenged several critical hazards, but allowed some informal shortcuts to pass without formal control.';
    } else {
      mainFeedback = 'Caution: You accepted multiple unmitigated risks based on supervisor reassurance. In industrial environments, always challenge unsafe conditions.';
    }

    if (triggeredRules.length > 0) {
      mainFeedback += ' ⚠️ Note: Multiple unaddressed warning signs led to a deferred incident escalation during this shift.';
    }

    feedbackEl.textContent = mainFeedback;
  }

  // Render or update detailed decision log table if container exists
  let logContainer = reportModal.querySelector('.report-log-container');
  if (!logContainer) {
    const feedbackSection = reportModal.querySelector('.report-feedback-section');
    if (feedbackSection) {
      logContainer = document.createElement('div');
      logContainer.className = 'report-log-container';
      feedbackSection.parentNode.insertBefore(logContainer, feedbackSection.nextSibling);
    }
  }

  if (logContainer && log.length > 0) {
    logContainer.innerHTML = `
      <h3 style="margin: 14px 0 8px; font-size: 14px; font-family: var(--font-heading); color: var(--color-dark-green);">
        Stop-by-Stop Patrol Record
      </h3>
      <div class="report-log-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
        ${log.map((item, idx) => {
          const isOptimal = item.outcome === 'optimal';
          const isFailure = item.outcome === 'failure';
          const badgeClass = isOptimal ? 'points-gain' : isFailure ? 'points-loss' : 'points-neutral';
          const outcomeLabel = item.outcome.toUpperCase();
          const actionName = item.actionKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(10,51,35,0.06); border-radius: 6px; font-size: 12px;">
              <span><strong>Stop ${idx + 1}:</strong> ${actionName}</span>
              <span class="points-badge ${badgeClass}">${outcomeLabel} (${item.points > 0 ? '+' : ''}${item.points} pts)</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
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
