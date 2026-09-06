/**
 * HUD.js
 * 
 * Industrial Safety Patrol Top Navigation HUD:
 *  - Left: SAFETY PATROL | SAFETY AUDIT
 *  - Center: ZONE 01 | Transit Line | Overturned Drum & Fluid Spill
 *  - Right: ● 00:00  COMPLIANCE  0 / 25 PTS
 */

const STOP_META = [
  { id: 'stop_01', num: '01', zone: 'ZONE 01', area: 'Transit Line', hazard: 'Overturned Drum & Fluid Spill' },
  { id: 'stop_02', num: '02', zone: 'ZONE 02', area: 'Vehicle Transit', hazard: 'Blind-Corner Forklift Traffic' },
  { id: 'stop_03', num: '03', zone: 'ZONE 03', area: 'High-Bay Storage', hazard: 'Structural Pallet Racking Defect' },
  { id: 'stop_04', num: '04', zone: 'ZONE 04', area: 'Charging Bay', hazard: 'Battery Charging Station Hazard' },
  { id: 'stop_05', num: '05', zone: 'ZONE 05', area: 'Dispatch Area', hazard: 'Loading Dock & Emergency Hub' },
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
    this._startTime = Date.now();
    this._elapsedSeconds = 0;
    this._timerInterval = null;

    this._startTimer();
    this._render();

    eventBus.on('stop:entered', ({ stop }) => {
      this._stopIndex = parseInt(stop.id.split('_')[1], 10) || 1;
      this._render();
    });

    eventBus.on('score:changed', ({ total, points = 0 }) => {
      this._score = total;
      this._render(points !== 0 ? (points > 0 ? `+${points}` : `${points}`) : '');
    });

    eventBus.on('session:complete', () => {
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
      }
    });
  }

  _startTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._startTime = Date.now();
    this._timerInterval = setInterval(() => {
      this._elapsedSeconds = Math.floor((Date.now() - this._startTime) / 1000);
      const timerEl = document.getElementById('hud-timer-val');
      if (timerEl) {
        timerEl.textContent = this._formatTime(this._elapsedSeconds);
      }
    }, 1000);
  }

  _formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  _render(scoreDeltaText = '') {
    const currentMeta = STOP_META[this._stopIndex - 1] || STOP_META[0];
    const formattedTime = this._formatTime(this._elapsedSeconds);

    this._el.innerHTML = `
      <nav class="nav-clean">
        <!-- 1. Left: Brand & Patrol Mode -->
        <div class="hud-left">
          <span class="hud-brand-main">SAFETY PATROL</span>
          <span class="hud-sep">|</span>
          <span class="hud-brand-sub">SAFETY AUDIT</span>
        </div>

        <!-- 2. Center: Zone / Area / Hazard Title -->
        <div class="hud-center">
          <span class="hud-zone-badge">${currentMeta.zone}</span>
          <span class="hud-sep">|</span>
          <span class="hud-area-text">${currentMeta.area}</span>
          <span class="hud-sep">|</span>
          <span class="hud-hazard-text">${currentMeta.hazard}</span>
        </div>

        <!-- 3. Right: Live Timer, Compliance, and Score -->
        <div class="hud-right">
          <div class="hud-timer">
            <span class="hud-live-dot" aria-hidden="true">●</span>
            <span class="hud-timer-val" id="hud-timer-val">${formattedTime}</span>
          </div>

          <span class="hud-compliance-label">COMPLIANCE</span>

          <div class="hud-score">
            <span class="hud-score-val">${this._score}</span>
            <span class="hud-score-denom">/ 25 PTS</span>
            ${scoreDeltaText ? `<span class="score-delta animate-pop ${scoreDeltaText.startsWith('-') ? 'negative' : 'positive'}">${scoreDeltaText}</span>` : ''}
          </div>
        </div>
      </nav>
    `;
  }
}
