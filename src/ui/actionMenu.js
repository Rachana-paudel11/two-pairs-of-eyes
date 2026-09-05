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
  cordon_off:            { label: 'Cordon Off',            hint: 'Restrict access and secure the area' },
  report_only:           { label: 'Report Only',           hint: 'Flag the hazard but keep the area open' },
  ignore:                { label: 'Ignore & Continue',     hint: 'Follow Dave and move on' },
  hold_position:         { label: 'Hold Position',         hint: 'Wait and establish eye contact with the driver' },
  proceed_carefully:     { label: 'Proceed Carefully',     hint: 'Move through while signalling to the driver' },
  walk_straight_through: { label: 'Walk Straight Through', hint: 'Continue without stopping' },
  isolate_and_report:    { label: 'Isolate & Report',      hint: 'Hit emergency stop and notify maintenance' },
  emergency_drill:       { label: 'Emergency Hub Drill',   hint: 'Test crisis response protocols for eye splash, cardiac arrest & deluge' },
  continue_on:           { label: 'Continue On',           hint: 'This area is clear — no action needed' },
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

    eventBus.on('action:resolved', ({ feedback }) => {
      this._hide();
      if (feedback) this._showToast(feedback, true);
    });

    eventBus.on('stop:entered', () => {
      // Clear any previous toast on new stop
      this._hideToast();
    });

    // On session complete, remove the continue button if present
    eventBus.on('session:complete', () => {
      this._hideToast();
    });
  }

  _render(actionKeys) {
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
    this._el.setAttribute('hidden', '');
    this._el.innerHTML = '';
  }

  _showToast(text, showContinue = false) {
    // Clear any existing continue button
    this._toast.innerHTML = '';
    this._toast.style.opacity = '1';

    const msg = document.createElement('p');
    msg.style.margin = '0';
    msg.textContent = text;
    this._toast.appendChild(msg);

    if (showContinue) {
      const btn = document.createElement('button');
      btn.id = 'continue-btn';
      btn.textContent = 'Continue to Next Stop';
      btn.setAttribute('aria-label', 'Continue to the next stop');
      btn.style.cssText = [
        'display:block', 'margin:14px auto 0', 'padding:10px 32px',
        'background:linear-gradient(135deg,#f5a623,#e05a00)',
        'border:none', 'border-radius:99px', 'color:#fff',
        "font-family:var(--font,'Inter',sans-serif)", 'font-size:0.92rem',
        'font-weight:700', 'cursor:pointer',
        'box-shadow:0 4px 16px rgba(245,166,35,0.4)',
        'transition:transform 0.15s ease',
      ].join(';');
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-2px)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      btn.addEventListener('click', () => {
        this._eventBus.emit('ui:continue');
        this._hideToast();
      });
      this._toast.appendChild(btn);
    } else {
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this._hideToast(), 5000);
    }
  }

  _hideToast() {
    clearTimeout(this._continueTimer);
    this._toast.style.opacity = '0';
    setTimeout(() => { this._toast.innerHTML = ''; }, 400);
  }
}
