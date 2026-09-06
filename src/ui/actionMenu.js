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
    this._toastTimer = null;
    this._continueTimer = null;

    eventBus.on('actions:available', ({ actions }) => {
      this._render(actions);
    });

    eventBus.on('action:resolved', () => {
      this._renderContinue();
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

  _renderContinue() {
    const isLastStop = Boolean(this._engine && this._engine.stopIndex >= (this._engine.stops.length - 1));
    const label = isLastStop ? 'View Debrief' : 'Next Zone';

    this._el.classList.add('is-continue');
    this._el.innerHTML = `
      <button
        class="continue-pill-btn ${isLastStop ? 'final-stop-btn' : ''}"
        id="continue-stop-btn"
        aria-label="${label}"
      >
        <span>${label}</span>
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

    this._el.removeAttribute('hidden');
  }

  _render(actionKeys) {
    this._el.classList.remove('is-continue');
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
    this._el.classList.remove('is-continue');
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
