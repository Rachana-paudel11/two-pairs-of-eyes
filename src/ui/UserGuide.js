/**
 * UserGuide.js
 * 
 * Clean, uncluttered, interactive gameplay guide for the safety patrol simulation.
 * Minimalist design: zero emojis, zero icon clutter, zero step numbers.
 * Theme: Midnight Green (#105666) & Warm Beige (#F7F4D5) with Rosy Brown (#D3968C) accents.
 */

export class UserGuide {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._currentStep = 0;
    this._isOpen = false;
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
        tabName: 'Look for Hazards',
        title: 'Arrive and Look Around',
        tagline: 'Look around in 3D to find any danger or safety issue',
        whatYouSee: 'Alex and Dave walk into the patrol area. A hazard is present somewhere nearby in the warehouse.',
        whatYouDo: 'Click and drag anywhere on the 3D warehouse view to turn the camera and find the risk (like a spilled chemical drum, bent rack, or forklift crossing).',
        hint: 'Walking is automatic. Focus on looking around carefully.'
      },
      {
        id: 'dialogue',
        tabName: 'Supervisor Advice',
        title: 'Listen to Dave',
        tagline: 'Notice when the supervisor asks you to skip safety steps',
        whatYouSee: 'A speech bubble appears over Supervisor Dave showing his attitude (Dismissive, Uncertain, or Correct).',
        whatYouDo: 'Read his words carefully. If Dave tries to rush you or ignore a risk, stand your ground and follow proper safety rules.',
        hint: 'Dave’s tag shows if he is trying to ignore or bypass safety standards.'
      },
      {
        id: 'actions',
        tabName: 'Choose Action',
        title: 'Pick the Safest Choice',
        tagline: 'Choose the best response from the action list',
        whatYouSee: 'Three choices appear in the action box at the bottom right corner of the screen.',
        whatYouDo: 'Select the best action: Best safety response (+5 PTS), partial workaround (+3 PTS), or unsafe shortcut (-3 PTS). Alex will perform the action.',
        hint: 'Ignoring hazards early on can cause bigger accidents later in the walk.'
      },
      {
        id: 'resolution',
        tabName: 'Scores and Review',
        title: 'Review Your Result',
        tagline: 'Check how well you handled the situation and view your score',
        whatYouSee: 'A safety resolution banner shows the outcome, and your score updates in the top bar.',
        whatYouDo: 'Continue through all 5 zones. At the end, review your full Safety Scorecard and debrief.',
        hint: 'Try to get a perfect score of 25/25 with zero safety incidents.'
      }
    ];

    this._handleKeyDown = (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.close();
      }
    };
    window.addEventListener('keydown', this._handleKeyDown);

    if (this._bus) {
      this._bus.on('ui:open-guide', () => this.open());
    }
  }

  open(initialStep = 0) {
    this._isOpen = true;
    this._currentStep = Math.max(0, Math.min(initialStep, this._steps.length - 1));
    this._render();
    this._el.removeAttribute('hidden');
    this._el.style.display = 'flex';
    requestAnimationFrame(() => {
      this._el.classList.add('user-guide-visible');
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

  _setStep(index) {
    this._currentStep = index;
    this._render();
  }

  _render() {
    const step = this._steps[this._currentStep];
    const isFirst = this._currentStep === 0;
    const isLast = this._currentStep === this._steps.length - 1;

    this._el.innerHTML = `
      <div class="user-guide-card guide-theme-midnight" role="dialog" aria-modal="true" aria-labelledby="guide-step-title">
        <!-- Header: Clean and uncluttered -->
        <div class="guide-header">
          <span class="guide-brand-title">Simulation Gameplay Guide</span>
          <button id="guide-close-btn" class="guide-close-btn" aria-label="Close Guide">&times;</button>
        </div>

        <!-- Clean Text Tabs (No numbers, no icons) -->
        <div class="guide-steps-bar" role="tablist">
          ${this._steps.map((s, idx) => `
            <button class="guide-step-tab ${idx === this._currentStep ? 'active' : ''}" data-step="${idx}" role="tab" aria-selected="${idx === this._currentStep}">
              <span class="step-tab-name">${s.tabName}</span>
            </button>
          `).join('')}
        </div>

        <!-- Clean Content Body -->
        <div class="guide-body">
          <div class="guide-header-text">
            <h2 id="guide-step-title" class="guide-step-title">${step.title}</h2>
            <p class="guide-tagline">${step.tagline}</p>
          </div>

          <div class="guide-points-list">
            <div class="guide-point-row">
              <div class="point-text-block">
                <span class="point-heading">Simulation View</span>
                <p class="point-desc">${step.whatYouSee}</p>
              </div>
            </div>

            <div class="guide-point-row">
              <div class="point-text-block">
                <span class="point-heading">Your Action</span>
                <p class="point-desc">${step.whatYouDo}</p>
              </div>
            </div>
          </div>

          <div class="guide-tip-row">
            <p class="tip-content"><span class="tip-label">Key Rule</span> ${step.hint}</p>
          </div>
        </div>

        <!-- Clean Footer Actions -->
        <div class="guide-footer">
          <div class="guide-dots-indicator">
            ${this._steps.map((_, idx) => `
              <span class="guide-dot ${idx === this._currentStep ? 'active' : ''}"></span>
            `).join('')}
          </div>

          <div class="guide-btn-group">
            ${!isFirst ? `
              <button id="guide-prev-btn" class="guide-btn guide-btn-prev">Previous</button>
            ` : ''}

            ${!isLast ? `
              <button id="guide-next-btn" class="guide-btn guide-btn-next">Next</button>
            ` : `
              <button id="guide-finish-btn" class="guide-btn guide-btn-finish">Resume Patrol</button>
            `}
          </div>
        </div>
      </div>
    `;

    // Wire Event Listeners
    this._el.querySelector('#guide-close-btn')?.addEventListener('click', () => this.close());
    this._el.querySelector('#guide-finish-btn')?.addEventListener('click', () => this.close());

    this._el.querySelector('#guide-prev-btn')?.addEventListener('click', () => {
      if (this._currentStep > 0) this._setStep(this._currentStep - 1);
    });

    this._el.querySelector('#guide-next-btn')?.addEventListener('click', () => {
      if (this._currentStep < this._steps.length - 1) this._setStep(this._currentStep + 1);
    });

    this._el.querySelectorAll('.guide-step-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stepIdx = parseInt(e.currentTarget.getAttribute('data-step'), 10);
        if (!isNaN(stepIdx)) this._setStep(stepIdx);
      });
    });

    // Close on backdrop click
    this._el.onclick = (e) => {
      if (e.target === this._el) {
        this.close();
      }
    };
  }
}
