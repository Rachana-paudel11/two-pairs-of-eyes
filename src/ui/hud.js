// ── HUD Module ───────────────────────────────────────────────────────────────
// Manages top HUD overlay for score, live shift timer, and stop titles.

let hudTitleEl = null;
let hudScoreEl = null;
let hudTimerEl = null;
let timerSeconds = 0;
let timerInterval = null;

export function initHud() {
  hudTitleEl = document.querySelector('#hud-stop-title');
  hudScoreEl = document.querySelector('#hud-score');
  hudTimerEl = document.querySelector('#hud-timer');
}

export function startHudTimer() {
  timerSeconds = 0;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const secs = String(timerSeconds % 60).padStart(2, '0');
    if (hudTimerEl) {
      hudTimerEl.textContent = `${mins}:${secs}`;
    }
  }, 1000);
}

export function stopHudTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

export function updateHudScore(score, maxScore = 25) {
  if (hudScoreEl) {
    hudScoreEl.textContent = `${score} / ${maxScore} PTS`;
  }
}

export function updateHudTitle(title) {
  if (hudTitleEl) {
    hudTitleEl.textContent = `${title}`;
  }
}
