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
  if (!hudTimerEl) initHud();
  timerSeconds = 0;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const secs = String(timerSeconds % 60).padStart(2, '0');
    if (!hudTimerEl) hudTimerEl = document.querySelector('#hud-timer');
    if (hudTimerEl) {
      hudTimerEl.textContent = `${mins}:${secs}`;
    }
  }, 1000);
}

export function stopHudTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

export function updateHudScore(score, maxScore = 25) {
  if (!hudScoreEl) initHud();
  if (hudScoreEl) {
    hudScoreEl.textContent = `${score} / ${maxScore} PTS`;
  }
}

export function resetHudTimer() {
  stopHudTimer();
  timerSeconds = 0;
  if (hudTimerEl) {
    hudTimerEl.textContent = '00:00';
  }
}

export function updateHudTitle(title) {
  if (!hudTitleEl) initHud();
  if (hudTitleEl) {
    if (title && title.includes('|')) {
      const parts = title.split('|').map(p => p.trim());
      const zoneTag = parts[0];
      const rest = parts.slice(1).join(' <span style="opacity:0.4; margin:0 4px;">|</span> ');
      hudTitleEl.innerHTML = `<span style="color: #A3E635; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(163,230,53,0.6);">${zoneTag}</span> <span style="opacity:0.4; margin:0 4px;">|</span> <span>${rest}</span>`;
    } else {
      hudTitleEl.textContent = `${title}`;
    }
  }
}


