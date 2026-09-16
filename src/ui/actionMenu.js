/**
 * ActionMenu.js
 * Renders the action buttons at the bottom of the screen.
 * Subscribes to: actions:available
 * Emits: ui:continue via eventBus to advance the engine after action resolution
 */

// Human-readable labels for each action key from stops.json.
//
// Deliberately NO icons. The trainee has to judge the hazard unaided, so the UI
// must not rank or hint at the options. A glyph that differs between choices is
// an answer key: a warning triangle marks one option risky, a stop-hand marks
// another correct. Keep every option visually identical. Do not re-add icons.
const ACTION_META = {
  cordon_off:            { label: 'Block Off Area',              hint: 'Put up safety cones and warning tape' },
  report_only:           { label: 'Report to Team',              hint: 'Log the hazard without blocking off danger' },
  ignore:                { label: 'Ignore Hazard',               hint: 'Follow Dave and walk past without fixing it' },
  hold_position:         { label: 'Stop and Wait',               hint: 'Wait behind the line until the forklift passes' },
  proceed_carefully:     { label: 'Wave and Cross',              hint: 'Wave to the driver and walk across the path' },
  walk_straight_through: { label: 'Walk Straight Across',        hint: 'Cross the intersection without stopping to check' },
  isolate_and_report:    { label: 'Turn Off Power and Report',   hint: 'Press emergency stop and call maintenance' },
  emergency_drill:       { label: 'Check Emergency Equipment',   hint: 'Inspect eyewash, first aid, and safety gear' },
  continue_on:           { label: 'Keep Walking Past',           hint: 'Walk past without checking safety equipment' },
};

export class ActionMenu {
  /**
   * @param {object} eventBus
   * @param {import('../engine/scenarioEngine.js').ScenarioEngine} engine
   */
  constructor(eventBus, engine) {
    this._el = document.getElementById('action-menu');
    this._engine = engine;
    this._eventBus = eventBus;
    this._toast = document.getElementById('toast');
    this._clearanceTimer = null;
    this._hide();

    eventBus.on('actions:available', ({ actions }) => {
      this._render(actions);
    });

    eventBus.on('action:resolved', ({ stopId, alexAction, outcome = 'optimal', points = 0, feedback = '' } = {}) => {
      if (this._clearanceTimer) {
        clearTimeout(this._clearanceTimer);
        this._clearanceTimer = null;
      }

      if (stopId === 'stop_04' && alexAction === 'isolate_equipment') {
        this._renderObservingStatus('Isolating charger power and applying lockout tag...');
        let resolved = false;
        const showCard = () => {
          if (resolved) return;
          resolved = true;
          if (this._clearanceTimer) {
            clearTimeout(this._clearanceTimer);
            this._clearanceTimer = null;
          }
          if (typeof unsub === 'function') unsub();
          this._renderContinue(outcome, points, feedback, stopId, alexAction);
        };

        // Listen for when the E-stop disconnect switch is hit
        const unsub = (eventBus && typeof eventBus.on === 'function')
          ? eventBus.on('stop04:isolated', showCard)
          : null;

        // Guaranteed fallback timer so the card is never permanently blocked
        this._clearanceTimer = setTimeout(showCard, 4500);
      } else if (stopId === 'stop_02' && alexAction === 'hold_position') {
        this._renderObservingStatus('Waiting for forklift to clear junction...');
        this._clearanceTimer = setTimeout(() => {
          this._clearanceTimer = null;
          this._renderContinue(outcome, points, feedback, stopId, alexAction);
        }, 2100);
      } else {
        this._renderContinue(outcome, points, feedback, stopId, alexAction);
      }
    });

    eventBus.on('stop:entered', () => {
      this._hide();
      this._hideToast();
    });

    // On session complete, remove the continue button if present
    eventBus.on('session:complete', () => {
      this._hide();
      this._hideToast();
    });
  }

  _renderObservingStatus(text = 'Waiting for forklift to clear junction...') {
    this._el.classList.add('is-continue');
    this._el.innerHTML = `
      <div class="crossing-status-badge in-progress" role="status" aria-live="polite">
        <span class="status-pulse-dot" aria-hidden="true"></span>
        <span class="status-badge-text">${text}</span>
      </div>
    `;
    this._el.removeAttribute('hidden');
  }

  _renderContinue(outcome = 'optimal', points = 0, feedback = '', stopId = null, alexAction = null) {
    const currentIndex = this._engine ? this._engine.stopIndex : 0;
    const totalStops = (this._engine && this._engine.stops) ? this._engine.stops.length : 5;
    const isLastStop = currentIndex >= (totalStops - 1);

    let label = 'Next Zone';
    if (isLastStop) {
      label = 'View Final Debrief';
    } else if (stopId === 'stop_02') {
      if (alexAction === 'hold_position') {
        label = 'Cross Safely & Inspect Zone 03';
      } else if (alexAction === 'proceed_carefully') {
        label = 'Proceed to Zone 03';
      } else {
        label = 'Continue to Zone 03';
      }
    } else {
      const nextZoneNum = String(currentIndex + 2).padStart(2, '0');
      label = `Inspect Zone ${nextZoneNum}`;
    }

    let outcomeTitle = 'SAFETY RESOLUTION';
    let outcomeIcon = '✓';
    let statusClass = 'optimal';
    let scoreText = points > 0 ? `+${points} PTS` : `${points} PTS`;

    if (outcome === 'failure') {
      outcomeTitle = 'SAFETY HAZARD RISK';
      outcomeIcon = '🛑';
      statusClass = 'failure';
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '-3 PTS';
    } else if (outcome === 'partial') {
      outcomeTitle = 'PARTIAL COMPLIANCE';
      outcomeIcon = '⚠️';
      statusClass = 'partial';
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '+3 PTS';
    } else {
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '+5 PTS';
    }

    const borderColor = outcome === 'failure' ? 'rgba(244, 63, 94, 0.7)' : (outcome === 'partial' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)');
    const glowColor = outcome === 'failure' ? 'rgba(244, 63, 94, 0.25)' : (outcome === 'partial' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)');
    const titleColor = outcome === 'failure' ? '#fb7185' : (outcome === 'partial' ? '#fbbf24' : '#34d399');
    const scoreBg = outcome === 'failure' ? 'rgba(244, 63, 94, 0.22)' : (outcome === 'partial' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(16, 185, 129, 0.22)');

    this._el.classList.add('is-continue');
    this._el.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      left: auto !important;
      top: auto !important;
      width: 420px !important;
      max-width: calc(100vw - 48px) !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      gap: 10px !important;
      z-index: 200 !important;
    `;

    this._el.innerHTML = `
      <div class="safety-outcome-card ${statusClass}" style="
        width: 100% !important;
        box-sizing: border-box !important;
        background: rgba(13, 20, 28, 0.96) !important;
        backdrop-filter: blur(18px) !important;
        -webkit-backdrop-filter: blur(18px) !important;
        border: 1px solid ${borderColor} !important;
        border-radius: 12px !important;
        padding: 16px 20px !important;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.85), 0 0 24px ${glowColor} !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      ">
        <div class="safety-outcome-header ${statusClass}" style="
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding-bottom: 8px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        ">
          <div class="safety-outcome-left" style="display: flex !important; align-items: center !important; gap: 8px !important;">
            <span class="safety-outcome-icon" aria-hidden="true" style="font-size: 1.1rem !important; line-height: 1 !important;">${outcomeIcon}</span>
            <span class="safety-outcome-title" style="
              font-family: var(--font, 'Inter', sans-serif) !important;
              font-size: 0.82rem !important;
              font-weight: 800 !important;
              letter-spacing: 0.08em !important;
              text-transform: uppercase !important;
              color: ${titleColor} !important;
            ">${outcomeTitle}</span>
          </div>
          <span class="safety-outcome-score ${statusClass}" style="
            font-family: var(--font-mono, monospace) !important;
            font-size: 0.92rem !important;
            font-weight: 800 !important;
            color: ${titleColor} !important;
          ">${scoreText}</span>
        </div>
        ${feedback ? `<p class="safety-outcome-feedback" style="
          font-family: var(--font, 'Inter', sans-serif) !important;
          font-size: 0.90rem !important;
          line-height: 1.52 !important;
          color: #f1f5f9 !important;
          font-weight: 500 !important;
          margin: 0 !important;
        ">${feedback}</p>` : ''}
        <div class="safety-outcome-arrow" aria-hidden="true"></div>
      </div>
      <div class="nav-objective-hint" style="width: 100% !important; display: flex !important; justify-content: flex-end !important; margin-top: 2px !important;">
        ${isLastStop ? '' : '<span class="nav-hint-text" style="font-family: var(--font-mono, monospace) !important; font-size: 0.76rem !important; font-weight: 600 !important; color: #cbd5e1 !important; display: flex !important; align-items: center !important; gap: 6px !important; text-shadow: 0 1px 4px rgba(0,0,0,0.8) !important;">Walk to next zone using <span class="hint-chip" style="background: rgba(255,255,255,0.16) !important; border: 1px solid rgba(255,255,255,0.3) !important; border-radius: 4px !important; padding: 1px 6px !important; color: #fef08a !important; font-weight: 800 !important; font-size: 0.72rem !important;">WASD</span> or</span>'}
      </div>
      <button
        class="continue-pill-btn ${isLastStop ? 'final-stop-btn' : ''}"
        id="continue-stop-btn"
        aria-label="${label}"
      >
        <span>${isLastStop ? label : `${label} [E]`}</span>
      </button>
    `;

    const btn = this._el.querySelector('#continue-stop-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        this._hide();
        this._eventBus.emit('ui:continue');
      });
    }

    // Keyboard shortcut [E] to trigger continue / auto-walk
    const onKeyE = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'KeyE') {
        const cBtn = document.getElementById('continue-stop-btn');
        if (cBtn && !cBtn.disabled && cBtn.offsetParent !== null) {
          e.preventDefault();
          window.removeEventListener('keydown', onKeyE);
          cBtn.click();
        }
      }
    };
    window.addEventListener('keydown', onKeyE);

    this._el.removeAttribute('hidden');
  }

  _render(actionKeys) {
    this._el.classList.remove('is-continue');
    this._el.style.cssText = '';
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    this._el.innerHTML = `
      <p class="action-prompt">What do you do?</p>
      ${actionKeys.map((key) => {
        const meta = ACTION_META[key] ?? { label: key, hint: '' };
        return `
          <button
            class="action-btn"
            data-action="${key}"
            id="action-btn-${key}"
            aria-label="${meta.label}: ${meta.hint}"
          >
            <span>
              <div class="action-label">${meta.label}</div>
              <div class="action-hint">${meta.hint}</div>
            </span>
          </button>
        `;
      }).join('')}
    `;

    // Bind clicks
    this._el.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.action;
        if (key === 'emergency_drill') {
          this._hide();
          this._eventBus.emit('drill:start');
          return;
        }
        // Disable all buttons immediately to prevent double-click
        this._el.querySelectorAll('.action-btn').forEach((b) => b.disabled = true);
        this._engine.chooseAction(key);
      });
    });

    this._el.removeAttribute('hidden');
  }

  _hide() {
    if (this._clearanceTimer) {
      clearTimeout(this._clearanceTimer);
      this._clearanceTimer = null;
    }
    this._el.classList.remove('is-continue');
    this._el.style.cssText = '';
    this._el.setAttribute('hidden', '');
    this._el.innerHTML = '';
  }

  _showToast(text, showContinue = false) {
    // Clear any existing continue button
    this._toast.removeAttribute('hidden');
    this._toast.innerHTML = '';
    this._toast.style.opacity = '1';

    const card = document.createElement('div');
    card.className = 'feedback-toast-card';

    const header = document.createElement('div');
    header.className = 'feedback-toast-header';
    header.innerHTML = `
      <span class="feedback-badge">SAFETY OUTCOME</span>
    `;
    card.appendChild(header);

    const msg = document.createElement('p');
    msg.className = 'feedback-toast-text';
    msg.textContent = text;
    card.appendChild(msg);

    if (showContinue) {
      const btn = document.createElement('button');
      btn.id = 'continue-btn';
      btn.className = 'continue-next-btn';
      btn.textContent = 'Continue to Next Stop';
      btn.setAttribute('aria-label', 'Continue to the next stop');
      btn.addEventListener('click', () => {
        this._eventBus.emit('ui:continue');
        this._hideToast();
      });
      card.appendChild(btn);
    } else {
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this._hideToast(), 5000);
    }

    this._toast.appendChild(card);
  }

  _hideToast() {
    clearTimeout(this._continueTimer);
    this._toast.style.opacity = '0';
    setTimeout(() => {
      this._toast.innerHTML = '';
      this._toast.setAttribute('hidden', '');
    }, 400);
  }
}
