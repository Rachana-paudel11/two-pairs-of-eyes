// ── Debrief / Safety Report Module ──────────────────────────────────────────
// Manages the end-of-patrol scorecard modal, compliance grading, and restart flow.

let reportModal      = null;
let finalScoreEl     = null;
let gradeEl          = null;
let challengedEl     = null;
let feedbackEl       = null;
let btnRestart       = null;
let btnClose         = null;

export function initDebrief({ onRestart } = {}) {
  reportModal  = document.querySelector('#report-modal');
  finalScoreEl = document.querySelector('#report-final-score');
  gradeEl      = document.querySelector('#report-grade');
  challengedEl = document.querySelector('#report-challenged-count');
  feedbackEl   = document.querySelector('#report-feedback-text');
  btnRestart   = document.querySelector('#btn-restart-sim');
  btnClose     = document.querySelector('#btn-close-report');

  if (btnClose) {
    btnClose.addEventListener('click', hideDebrief);
  }

  if (btnRestart && onRestart) {
    btnRestart.addEventListener('click', () => {
      hideDebrief();
      onRestart();
    });
  }
}

export function showDebrief(score, totalChallenges = 0, maxScore = 25) {
  if (!reportModal) return;

  if (finalScoreEl) finalScoreEl.textContent = `${score} / ${maxScore}`;
  if (challengedEl) challengedEl.textContent = `${totalChallenges} of 5`;

  if (gradeEl && feedbackEl) {
    if (score >= 20) {
      gradeEl.textContent = 'Level 1 (Exemplary H&S)';
      gradeEl.className = 'stat-val grade-a';
      feedbackEl.textContent = 'Outstanding vigilance! You consistently prioritized official safety protocol over informal supervisor pressure, successfully stopping risks from normalizing.';
    } else if (score >= 10) {
      gradeEl.textContent = 'Level 2 (Competent)';
      gradeEl.className = 'stat-val primary';
      feedbackEl.textContent = 'Good hazard awareness. You challenged several key hazards, but allowed some informal shortcuts to pass without formal logging.';
    } else {
      gradeEl.textContent = 'Level 3 (Action Required)';
      gradeEl.className = 'stat-val';
      feedbackEl.textContent = 'Caution: You accepted multiple unmitigated risks based on supervisor reassurance. In industrial environments, always challenge unsafe conditions.';
    }
  }

  reportModal.style.display = 'flex';
}

export function hideDebrief() {
  if (reportModal) reportModal.style.display = 'none';
}

export function toggleDebrief(score, totalChallenges = 0, maxScore = 25) {
  if (!reportModal) return;
  if (reportModal.style.display === 'flex') {
    hideDebrief();
  } else {
    showDebrief(score, totalChallenges, maxScore);
  }
}
