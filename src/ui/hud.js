/**
 * HUD.js
 * 
 * Industrial Safety Patrol Top Navigation HUD:
 *  - Left: SAFETY PATROL | SAFETY AUDIT
 *  - Center: ZONE 01 | Transit Line | Overturned Drum & Fluid Spill
 *  - Right: ● 00:00  COMPLIANCE  0 / 25 PTS
 */

import { isSfxMuted, setSfxMuted, playSfx } from '../utils/audio.js';

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
    this._startTime = null;
    this._elapsedSeconds = 0;
    this._timerInterval = null;

    this._render();
    this._actionPending = false;
    this._targetScore = 0;
    this._targetDelta = '';

    eventBus.on('stop:entered', ({ stop }) => {
      if (this._el) this._el.hidden = false;
      this._actionPending = false;
      this._stopIndex = parseInt(stop.id.split('_')[1], 10) || 1;
      if (!this._timerInterval) {
        this._startTimer();
      }
      this._render();
    });

    eventBus.on('action:resolved', () => {
      this._actionPending = true;
    });

    eventBus.on('score:changed', ({ total, points = 0 }) => {
      this._targetScore = total;
      this._targetDelta = points !== 0 ? (points > 0 ? `+${points}` : `${points}`) : '';
      if (!this._actionPending) {
        this._score = this._targetScore;
        this._render(this._targetDelta);
      }
    });

    eventBus.on('action:outcome:displayed', () => {
      this._actionPending = false;
      this._score = this._targetScore;
      this._render(this._targetDelta);
    });

    eventBus.on('game:paused', () => {
      this._isPaused = true;
    });

    eventBus.on('game:resumed', () => {
      this._isPaused = false;
    });

    eventBus.on('session:resume:timer', ({ elapsedSeconds = 0 } = {}) => {
      this._startTimer(elapsedSeconds);
    });

    eventBus.on('session:complete', () => {
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
      }
    });
  }

  _startTimer(resumeSeconds = 0) {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._elapsedSeconds = Number(resumeSeconds) || 0;
    this._startTime = Date.now() - (this._elapsedSeconds * 1000);
    this._timerInterval = setInterval(() => {
      if (this._isPaused) {
        this._startTime += 1000;
        return;
      }
      this._elapsedSeconds = Math.floor((Date.now() - this._startTime) / 1000);
      const timerEl = document.getElementById('hud-timer-val');
      if (timerEl) {
        timerEl.textContent = this._formatTime(this._elapsedSeconds);
      }
      if (this._bus && typeof this._bus.emit === 'function') {
        this._bus.emit('hud:timer:tick', { elapsedSeconds: this._elapsedSeconds });
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
        <!-- 1. Left: Role Badges (Player/Trainee & Supervisor) -->
        <div class="hud-left">
          <div class="hud-role-pill trainee-pill" title="You are playing as Alex, Safety Trainee">
            <span class="hud-role-dot" aria-hidden="true"></span>
            <span class="hud-role-tag">YOU (TRAINEE)</span>
            <span class="hud-role-name">Alex</span>
          </div>
          <span class="hud-sep" aria-hidden="true">•</span>
          <div class="hud-role-pill supervisor-pill" title="Accompanied by Dave, Operations Supervisor">
            <span class="hud-role-icon" aria-hidden="true">🛡️</span>
            <span class="hud-role-tag">SUPERVISOR</span>
            <span class="hud-role-name">Dave</span>
          </div>
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
            <span class="hud-score-val ${this._score < 0 ? 'negative' : ''}">${this._score}</span>
            <span class="hud-score-denom">/ 25 PTS</span>
            ${scoreDeltaText ? `<span class="score-delta animate-pop ${scoreDeltaText.startsWith('-') ? 'negative' : 'positive'}">${scoreDeltaText}</span>` : ''}
          </div>

          <button id="hud-mute-btn" class="hud-mute-btn" title="${isSfxMuted() ? 'Unmute Sound' : 'Mute Sound'}" aria-label="${isSfxMuted() ? 'Unmute Sound' : 'Mute Sound'}">
            <svg class="hud-sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              ${isSfxMuted()
                ? '<path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'
                : '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'
              }
            </svg>
          </button>

          <button id="hud-guide-btn" class="hud-guide-btn" title="Open Safety Patrol Guide" aria-label="Open Safety Patrol Guide">
            <span>Guide</span>
          </button>

          <button id="hud-pause-btn" class="hud-pause-btn" title="Pause Simulation (P / ESC)" aria-label="Pause Simulation">
            <svg class="hud-pause-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
              <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
            </svg>
          </button>
        </div>
      </nav>
    `;

    const hudMuteBtn = this._el.querySelector('#hud-mute-btn');
    if (hudMuteBtn) {
      hudMuteBtn.addEventListener('click', () => {
        const nextMuted = !isSfxMuted();
        setSfxMuted(nextMuted);
        if (!nextMuted) playSfx('ui-click');
        this._bus.emit('audio:mute:toggled', { muted: nextMuted });
        this._render();
      });
    }

    const hudGuideBtn = this._el.querySelector('#hud-guide-btn');
    if (hudGuideBtn) {
      hudGuideBtn.addEventListener('click', () => {
        this._bus.emit('ui:open-guide');
      });
    }

    const hudPauseBtn = this._el.querySelector('#hud-pause-btn');
    if (hudPauseBtn) {
      hudPauseBtn.addEventListener('click', () => {
        this._bus.emit('ui:pause-game');
      });
    }
  }
}
