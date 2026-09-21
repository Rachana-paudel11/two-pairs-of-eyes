/**
 * UserGuide.js
 *
 * Interactive gameplay guide for the safety patrol simulation.
 * Each step pairs its explanation with a small animated illustration of the
 * in-game moment it describes: looking around in 3D, Dave's speech bubble,
 * the action menu, and the compliance score.
 */

const ICONS = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"></path>',
  choice: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
  award: '<circle cx="12" cy="8" r="6"></circle><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"></path>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
  pointer: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>',
  bulb: '<path d="M9 18h6M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"></path>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="13 6 19 12 13 18"></polyline>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="11 6 5 12 11 18"></polyline>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// Solid mouse cursor used by the animated demos
const CURSOR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v16l4.5-4.5 3 6.5 2.6-1.2-3-6.3H18z"></path></svg>';

// Decorative illustrations, keyed by step id
const VISUALS = {
  inspect: `
    <div class="gv gv-inspect">
      <div class="gv-pan">
        <img class="gv-photo" src="/assets/images/warehouse_hero_bg_hd.jpg" alt="" />
        <span class="gv-shade"></span>
        <span class="gv-hazard">
          <span class="gv-hazard-ring"></span>
          <span class="gv-hazard-ring delay"></span>
          <span class="gv-hazard-core">${icon('alert')}</span>
        </span>
      </div>
      <span class="gv-corner tl"></span><span class="gv-corner tr"></span>
      <span class="gv-corner bl"></span><span class="gv-corner br"></span>
      <span class="gv-drag">
        <span class="gv-drag-demo"><span class="gv-drag-track"></span><span class="gv-drag-hand">${CURSOR_SVG}</span></span>
        <span class="gv-drag-label">Drag to look around</span>
      </span>
    </div>`,

  dialogue: `
    <div class="gv gv-dialogue">
      <span class="gv-backdrop"></span>
      <div class="gv-bubble">
        <div class="gv-bubble-head">
          <span class="gv-bubble-initial">D</span>
          <span class="gv-bubble-name">Dave</span>
          <span class="gv-behaviour">
            <span class="gv-chip dismissive">Dismissive</span>
            <span class="gv-chip uncertain">Uncertain</span>
            <span class="gv-chip correct">Correct</span>
          </span>
        </div>
        <span class="gv-line w90"></span>
        <span class="gv-line w65"></span>
        <span class="gv-bubble-tail"></span>
      </div>
      <div class="gv-speaker">
        <img class="gv-portrait" src="/assets/images/dave_avatar.png" alt="" />
        <span class="gv-speaker-name">Supervisor Dave</span>
      </div>
    </div>`,

  actions: `
    <div class="gv gv-actions">
      <span class="gv-backdrop"></span>
      <div class="gv-menu">
        <p class="gv-menu-prompt">What do you do?</p>
        <div class="gv-option optimal">
          <span class="gv-opt-icon">${icon('check')}</span>
          <span class="gv-opt-lines"><span class="gv-line w85"></span><span class="gv-line sm w60"></span></span>
          <span class="gv-pts">+5 PTS</span>
        </div>
        <div class="gv-option partial">
          <span class="gv-opt-icon">${icon('alert')}</span>
          <span class="gv-opt-lines"><span class="gv-line w65"></span><span class="gv-line sm w85"></span></span>
          <span class="gv-pts">+3 PTS</span>
        </div>
        <div class="gv-option failure">
          <span class="gv-opt-icon">${icon('close')}</span>
          <span class="gv-opt-lines"><span class="gv-line w90"></span><span class="gv-line sm w60"></span></span>
          <span class="gv-pts">-3 PTS</span>
        </div>
        <span class="gv-cursor">${CURSOR_SVG}</span>
      </div>
    </div>`,

  resolution: `
    <div class="gv gv-result">
      <span class="gv-backdrop"></span>
      <div class="gv-hud">
        <span class="gv-hud-dot"></span>
        <span>COMPLIANCE</span>
        <span class="gv-hud-score">25</span>
        <span>/ 25 PTS</span>
      </div>
      <div class="gv-gauge">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="gv-gauge-track" cx="60" cy="60" r="50"></circle>
          <circle class="gv-gauge-fill" cx="60" cy="60" r="50" pathLength="100"></circle>
        </svg>
        <div class="gv-gauge-text"><strong>25</strong><span>/ 25</span></div>
      </div>
      <ol class="gv-zones">
        ${[1, 2, 3, 4, 5].map(i => `<li style="--i:${i}">${icon('check')}</li>`).join('')}
      </ol>
    </div>`
};

export class UserGuide {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._currentStep = 0;
    this._isOpen = false;
    this._isPatrolStarted = false;
    this._fromStart = false;
    this._el = document.getElementById('user-guide-modal');
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'user-guide-modal';
      this._el.className = 'user-guide-overlay';
      this._el.setAttribute('hidden', '');
      this._el.style.display = 'none';
      document.body.appendChild(this._el);
    }

    this._steps = [
      {
        id: 'inspect',
        icon: 'eye',
        tabName: 'Look for Hazards',
        title: 'Arrive and Look Around',
        tagline: 'Look around in 3D to find any danger or safety issue',
        whatYouSee: 'Alex and Dave walk into the patrol area. A hazard is present somewhere nearby in the warehouse.',
        whatYouDo: 'Click and drag anywhere on the 3D warehouse view to turn the camera and find the risk (like a spilled chemical drum, bent rack, or forklift crossing).',
        hint: 'Walking is automatic. Focus on looking around carefully.'
      },
      {
        id: 'dialogue',
        icon: 'chat',
        tabName: 'Supervisor Advice',
        title: 'Listen to Dave',
        tagline: 'Notice when the supervisor asks you to skip safety steps',
        whatYouSee: 'A speech bubble appears over Supervisor Dave showing his attitude (Dismissive, Uncertain, or Correct).',
        whatYouDo: 'Read his words carefully. If Dave tries to rush you or ignore a risk, stand your ground and follow proper safety rules.',
        hint: 'Dave’s tag shows if he is trying to ignore or bypass safety standards.'
      },
      {
        id: 'actions',
        icon: 'choice',
        tabName: 'Choose Action',
        title: 'Pick the Safest Choice',
        tagline: 'Choose the best response from the action list',
        whatYouSee: 'Three choices appear in the action box at the bottom right corner of the screen.',
        whatYouDo: 'Select the best action: Best safety response (+5 PTS), partial workaround (+3 PTS), or unsafe shortcut (-3 PTS). Alex will perform the action.',
        hint: 'Ignoring hazards early on can cause bigger accidents later in the walk.'
      },
      {
        id: 'resolution',
        icon: 'award',
        tabName: 'Scores and Review',
        title: 'Review Your Result',
        tagline: 'Check how well you handled the situation and view your score',
        whatYouSee: 'A safety resolution banner shows the outcome, and your score updates in the top bar.',
        whatYouDo: 'Continue through all 5 zones. At the end, review your full Safety Scorecard and debrief.',
        hint: 'Try to get a perfect score of 25/25 with zero safety incidents.'
      }
    ];

    this._handleKeyDown = (e) => {
      if (!this._isOpen) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight') this._go(1, '.guide-step-tab.active');
      else if (e.key === 'ArrowLeft') this._go(-1, '.guide-step-tab.active');
    };
    window.addEventListener('keydown', this._handleKeyDown);

    if (this._bus) {
      this._bus.on('ui:open-guide', (payload) => this.open(payload));
      this._bus.on('stop:entered', () => {
        this._isPatrolStarted = true;
      });
      this._bus.on('session:complete', () => {
        this._isPatrolStarted = false;
      });
    }
  }

  open(options = {}) {
    let initialStep = 0;
    if (typeof options === 'number') {
      initialStep = options;
    } else if (options && typeof options.initialStep === 'number') {
      initialStep = options.initialStep;
    }

    if (options && typeof options.fromStart === 'boolean') {
      this._fromStart = options.fromStart;
    } else {
      this._fromStart = !this._isPatrolStarted;
    }

    this._isOpen = true;
    this._currentStep = Math.max(0, Math.min(initialStep, this._steps.length - 1));
    this._render();
    this._el.removeAttribute('hidden');
    this._el.style.display = 'flex';
    requestAnimationFrame(() => {
      this._el.classList.add('user-guide-visible');
      this._el.querySelector('.guide-step-tab.active')?.focus({ preventScroll: true });
    });
  }

  close() {
    this._isOpen = false;
    this._el.classList.remove('user-guide-visible');
    setTimeout(() => {
      if (!this._isOpen) {
        this._el.setAttribute('hidden', '');
        this._el.style.display = 'none';
      }
    }, 280);
  }

  _setStep(index, focusSelector) {
    this._currentStep = index;
    this._render(focusSelector);
  }

  _go(delta, focusSelector) {
    const next = this._currentStep + delta;
    if (next >= 0 && next < this._steps.length) this._setStep(next, focusSelector);
  }

  /**
   * @param {string} [focusSelector] Control to refocus after re-render, so
   *   keyboard users keep their place when the markup is replaced.
   */
  _render(focusSelector) {
    const step = this._steps[this._currentStep];
    const total = this._steps.length;
    const isFirst = this._currentStep === 0;
    const isLast = this._currentStep === total - 1;
    const stateOf = (idx) => idx === this._currentStep ? 'active' : idx < this._currentStep ? 'done' : '';

    const isPreStart = this._fromStart ?? !this._isPatrolStarted;
    const finishLabel = isPreStart ? 'Start Patrol' : 'Resume Patrol';
    const finishIcon = isPreStart ? icon('arrowRight') : icon('check');

    this._el.innerHTML = `
      <div class="user-guide-card" role="dialog" aria-modal="true" aria-labelledby="guide-step-title">
        <div class="guide-header">
          <div class="guide-brand">
            <span class="guide-badge-pill">PATROL GUIDE</span>
            <span class="guide-header-title">Warehouse Safety Protocol</span>
          </div>
          <button id="guide-close-btn" class="guide-close-btn" aria-label="Close Guide">
            ${icon('close')}
          </button>
        </div>

        <nav class="guide-tabs" aria-label="Guide Steps">
          ${this._steps.map((s, idx) => `
            <button
              class="guide-step-tab ${stateOf(idx)}"
              data-step="${idx}"
              role="tab"
              aria-selected="${idx === this._currentStep}"
              aria-label="Step ${idx + 1}: ${s.tabName}"
            >
              <span class="tab-index">${idx + 1}</span>
              <span class="tab-label">${s.tabName}</span>
            </button>
          `).join('')}
        </nav>

        <div class="guide-body">
          <div class="guide-visual-col" aria-hidden="true">
            ${VISUALS[step.id] || ''}
          </div>

          <div class="guide-text-col">
            <div class="guide-meta">
              <span class="guide-step-tag">Step ${this._currentStep + 1} of ${total}</span>
              <h2 id="guide-step-title" class="guide-title">${step.title}</h2>
              <p class="guide-tagline">${step.tagline}</p>
            </div>

            <div class="guide-points">
              <div class="guide-point-row">
                <span class="point-icon">${icon('eye')}</span>
                <div class="point-text-block">
                  <span class="point-heading">What You See</span>
                  <p class="point-desc">${step.whatYouSee}</p>
                </div>
              </div>

              <div class="guide-point-row">
                <span class="point-icon">${icon('pointer')}</span>
                <div class="point-text-block">
                  <span class="point-heading">Your Action</span>
                  <p class="point-desc">${step.whatYouDo}</p>
                </div>
              </div>
            </div>

            <div class="guide-tip-row">
              <span class="tip-icon">${icon('bulb')}</span>
              <p class="tip-content"><span class="tip-label">Key Rule:</span> ${step.hint}</p>
            </div>
          </div>
        </div>

        <div class="guide-footer">
          <div class="guide-progress">
            <span class="guide-progress-text">Step ${this._currentStep + 1} of ${total}</span>
            <div class="guide-dots" aria-hidden="true">
              ${this._steps.map((_, idx) => `<span class="guide-dot ${stateOf(idx)}"></span>`).join('')}
            </div>
          </div>

          <div class="guide-btn-group">
            ${!isFirst ? `
              <button id="guide-prev-btn" class="guide-btn guide-btn-prev">${icon('arrowLeft')}<span>Previous</span></button>
            ` : ''}

            ${!isLast ? `
              <button id="guide-next-btn" class="guide-btn guide-btn-next"><span>Next</span>${icon('arrowRight')}</button>
            ` : `
              <button id="guide-finish-btn" class="guide-btn guide-btn-finish"><span>${finishLabel}</span>${finishIcon}</button>
            `}
          </div>
        </div>
      </div>
    `;

    // Wire Event Listeners
    this._el.querySelector('#guide-close-btn')?.addEventListener('click', () => this.close());
    this._el.querySelector('#guide-finish-btn')?.addEventListener('click', () => {
      this.close();
      if (isPreStart && this._bus) {
        this._bus.emit('ui:start-patrol');
      }
    });
    this._el.querySelector('#guide-prev-btn')?.addEventListener('click', () => this._go(-1, '#guide-prev-btn'));
    this._el.querySelector('#guide-next-btn')?.addEventListener('click', () => this._go(1, '#guide-next-btn'));

    this._el.querySelectorAll('.guide-step-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stepIdx = parseInt(e.currentTarget.getAttribute('data-step'), 10);
        if (!isNaN(stepIdx)) this._setStep(stepIdx, `.guide-step-tab[data-step="${stepIdx}"]`);
      });
    });

    // Close on backdrop click
    this._el.onclick = (e) => {
      if (e.target === this._el) {
        this.close();
      }
    };

    // Narrow screens scroll the tab bar; keep the current step in view
    this._el.querySelector('.guide-step-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    if (focusSelector) {
      const target = this._el.querySelector(focusSelector)
        || this._el.querySelector('#guide-next-btn, #guide-finish-btn');
      target?.focus({ preventScroll: true });
    }
  }
}
