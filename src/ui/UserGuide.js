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
        tabName: 'Inspect Hazard',
        title: 'Arrive and Inspect',
        tagline: 'Look around in 3D to spot the warehouse hazard',
        whatYouSee: 'Alex and Dave walk into the patrol area. A hazard is present somewhere in the immediate environment.',
        whatYouDo: 'Click and drag anywhere on the 3D warehouse view to rotate your camera and locate the risk (e.g. leaking chemical drums, buckled pallet rack uprights, blind intersections).',
        hint: 'Movement is automatic along the patrol route. Focus on visual hazard inspection.'
      },
      {
        id: 'dialogue',
        tabName: 'Supervisor Advice',
        title: 'Read Dave’s Advice',
        tagline: 'Recognize supervisor peer pressure versus safety standards',
        whatYouSee: 'A speech bubble appears above Supervisor Dave with a behavior tag (Dismissive, Uncertain, or Compliant).',
        whatYouDo: 'Read his statement critically. Under shift delivery pressure, Dave may urge you to rush or skip reporting minor defects. Do not compromise safety standards.',
        hint: 'Dave’s attitude tag indicates when he is attempting to bypass standard protocol.'
      },
      {
        id: 'actions',
        tabName: 'Corrective Action',
        title: 'Choose Corrective Action',
        tagline: 'Select the OSHA-compliant response from the action menu',
        whatYouSee: 'Three distinct choices appear in the action menu at the bottom right corner of the screen.',
        whatYouDo: 'Select your chosen response: Optimal resolution (+5 PTS), partial workaround (+3 PTS), or unsafe shortcut (-3 PTS). Alex immediately enacts your response.',
        hint: 'Ignoring hazards in early stops causes escalated deferred emergencies at later zones.'
      },
      {
        id: 'resolution',
        tabName: 'Debrief and Scores',
        title: 'Resolution and Debrief',
        tagline: 'Review outcome feedback and final safety certification',
        whatYouSee: 'The safety status ribbon confirms whether the risk was resolved, while your live compliance score updates in the navigation bar.',
        whatYouDo: 'Continue to advance across all 5 zones. When finished, review your complete Performance Debrief and supervisor rating.',
        hint: 'Aim for a perfect 25/25 score with zero OSHA violations and zero deferred incidents.'
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
