/**
 * EmergencyDrillModal.js
 * Interactive Stop 05 Emergency Response Hub Mini-Game.
 * Teaches workers about the Eyewash Basin, AED Defibrillator, and Decontamination Washroom.
 */

export const DRILL_SCENARIOS = [
  {
    id: 'eye_splash',
    title: 'EMERGENCY SCENARIO 1 OF 3',
    category: 'CHEMICAL SPLASH',
    icon: '👁️',
    prompt: 'A technician was servicing battery cells when corrosive electrolyte solvent splashed directly into their face and eyes!',
    question: 'Which emergency facility must they use immediately?',
    targetId: 'eyewash',
    targetName: 'Eyewash Station Basin',
    options: [
      { id: 'shower', name: 'Emergency Washroom & Shower', icon: '🚿', desc: 'Full-body deluge washroom' },
      { id: 'eyewash', name: 'Eyewash Station Basin', icon: '👁️', desc: 'Twin aerated gentle flush nozzles' },
      { id: 'aed', name: 'AED Defibrillator Cabinet', icon: '⚡', desc: 'Cardiac electrical unit' }
    ],
    teachingTip: 'OSHA / ANSI Z358.1 Standard: Hit the green PUSH paddle with palm, hold eyelids open with fingers, and flush continuously for at least 15 minutes.'
  },
  {
    id: 'cardiac_arrest',
    title: 'EMERGENCY SCENARIO 2 OF 3',
    category: 'MEDICAL EMERGENCY',
    icon: '⚡',
    prompt: 'A colleague suddenly collapses in the aisle, unconscious, unresponsive, and without a pulse!',
    question: 'Which life-saving station must you retrieve immediately?',
    targetId: 'aed',
    targetName: 'AED Defibrillator Cabinet',
    options: [
      { id: 'eyewash', name: 'Eyewash Station Basin', icon: '👁️', desc: 'Twin aerated gentle flush nozzles' },
      { id: 'aed', name: 'AED Defibrillator Cabinet', icon: '⚡', desc: 'Cardiac electrical resuscitation' },
      { id: 'shower', name: 'Emergency Washroom & Shower', icon: '🚿', desc: 'Full-body deluge washroom' }
    ],
    teachingTip: 'AHA Resuscitation Standard: Retrieve the AED immediately. Open the lid to activate automated voice guidance, attach adhesive electrode pads, and begin chest compressions.'
  },
  {
    id: 'body_spill',
    title: 'EMERGENCY SCENARIO 3 OF 3',
    category: 'HAZARDOUS MATERIAL DELUGE',
    icon: '🚿',
    prompt: 'A 55-gallon drum of concentrated chemical detergent ruptured, soaking a worker\'s entire torso, arms, and coveralls!',
    question: 'Which emergency decontamination area is required?',
    targetId: 'shower',
    targetName: 'Emergency Washroom & Shower',
    options: [
      { id: 'aed', name: 'AED Defibrillator Cabinet', icon: '⚡', desc: 'Cardiac electrical resuscitation' },
      { id: 'shower', name: 'Emergency Washroom & Shower', icon: '🚿', desc: 'High-volume full-body deluge' },
      { id: 'eyewash', name: 'Eyewash Station Basin', icon: '👁️', desc: 'Twin aerated gentle flush nozzles' }
    ],
    teachingTip: 'Hazardous Chemical Deluge Protocol: Step into the washroom, pull the overhead shower lever, and strip saturated clothing while under the continuous water stream. Keep the 36-inch perimeter unobstructed.'
  }
];

export class EmergencyDrillModal {
  /**
   * @param {object} eventBus
   * @param {import('../engine/scenarioEngine.js').ScenarioEngine} engine
   */
  constructor(eventBus, engine) {
    this._eventBus = eventBus;
    this._engine = engine;
    this._el = document.getElementById('emergency-drill-modal');
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'emergency-drill-modal';
      this._el.className = 'drill-overlay';
      this._el.hidden = true;
      this._el.style.display = 'none';
      document.body.appendChild(this._el);
    } else {
      this._el.hidden = true;
      this._el.style.display = 'none';
    }

    this._currentIndex = 0;
    this._score = 0;
    this._answered = false;

    // Listen for custom trigger or stop_05 action
    eventBus.on('drill:start', () => {
      this.startDrill();
    });
  }

  startDrill() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this._currentIndex = 0;
    this._score = 0;
    this._answered = false;
    this._el.removeAttribute('hidden');
    this._el.style.display = 'flex';
    this._renderStep();
  }

  _renderStep() {
    if (this._currentIndex >= DRILL_SCENARIOS.length) {
      this._renderSummary();
      return;
    }

    const scenario = DRILL_SCENARIOS[this._currentIndex];
    this._answered = false;

    this._el.innerHTML = `
      <div class="drill-card">
        <div class="drill-header">
          <div class="drill-badge"><span class="badge-dot"></span> EMERGENCY RESPONSE DRILL</div>
          <div class="drill-step-counter">STEP ${this._currentIndex + 1} OF ${DRILL_SCENARIOS.length}</div>
        </div>

        <div class="drill-scenario-box">
          <div class="drill-scenario-tag">${scenario.icon} ${scenario.category}</div>
          <h2 class="drill-scenario-prompt">${scenario.prompt}</h2>
          <p class="drill-scenario-question">${scenario.question}</p>
        </div>

        <div class="drill-options-grid">
          ${scenario.options.map(opt => `
            <button class="drill-option-btn" data-id="${opt.id}" id="drill-opt-${opt.id}">
              <div class="drill-option-icon">${opt.icon}</div>
              <div class="drill-option-text">
                <div class="drill-option-title">${opt.name}</div>
                <div class="drill-option-desc">${opt.desc}</div>
              </div>
            </button>
          `).join('')}
        </div>

        <div id="drill-feedback" class="drill-feedback-box" hidden></div>
      </div>
    `;

    this._el.querySelectorAll('.drill-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._answered) return;
        this._handleAnswer(btn.dataset.id, scenario);
      });
    });
  }

  _handleAnswer(chosenId, scenario) {
    this._answered = true;
    const isCorrect = chosenId === scenario.targetId;
    if (isCorrect) {
      this._score += 2;
    }

    const allButtons = this._el.querySelectorAll('.drill-option-btn');
    allButtons.forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.id === scenario.targetId) {
        btn.classList.add('correct');
      } else if (btn.dataset.id === chosenId && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });

    const feedbackEl = this._el.querySelector('#drill-feedback');
    feedbackEl.removeAttribute('hidden');
    feedbackEl.className = `drill-feedback-box ${isCorrect ? 'fb-correct' : 'fb-incorrect'}`;
    feedbackEl.innerHTML = `
      <div class="fb-header">
        <span class="fb-status">${isCorrect ? '✅ PERFECT MATCH (+2 PTS)' : '⚠️ PROTOCOL CORRECTION'}</span>
      </div>
      <p class="fb-tip">${scenario.teachingTip}</p>
      <button class="drill-next-btn" id="drill-next-step">
        ${this._currentIndex + 1 < DRILL_SCENARIOS.length ? 'Next Scenario ➔' : 'View Audit Results ➔'}
      </button>
    `;

    this._el.querySelector('#drill-next-step').addEventListener('click', () => {
      this._currentIndex += 1;
      this._renderStep();
    });
  }

  _renderSummary() {
    const maxScore = DRILL_SCENARIOS.length * 2;
    const isPerfect = this._score === maxScore;

    this._el.innerHTML = `
      <div class="drill-card summary-card">
        <div class="drill-header">
          <div class="drill-badge"><span class="badge-dot"></span> AUDIT COMPLETE</div>
          <div class="drill-step-counter">STOP 05 VERIFICATION</div>
        </div>

        <div class="summary-hero">
          <div class="summary-trophy">${isPerfect ? '🏆' : '📋'}</div>
          <h1 class="summary-title">${isPerfect ? 'Certified First Responder' : 'Safety Review Complete'}</h1>
          <p class="summary-subtitle">
            ${isPerfect 
              ? 'Flawless execution! You identified the exact emergency stations required for ocular trauma, cardiac arrest, and chemical spills.' 
              : 'Good job verifying the safety stations. Remember that speed and precision save lives during warehouse emergencies.'}
          </p>
          <div class="summary-score-pill">
            <span class="summary-score-num">+${this._score}</span>
            <span class="summary-score-denom">/ ${maxScore} Emergency Bonus Points</span>
          </div>
        </div>

        <div class="summary-triad-recap">
          <div class="recap-item">
            <span class="recap-icon">👁️</span>
            <div>
              <strong>Eyewash Basin:</strong> 15-min continuous aerated flush for splashes.
            </div>
          </div>
          <div class="recap-item">
            <span class="recap-icon">⚡</span>
            <div>
              <strong>AED Cabinet:</strong> Automated vocal instructions for CPR & shock.
            </div>
          </div>
          <div class="recap-item">
            <span class="recap-icon">🚿</span>
            <div>
              <strong>Decon Shower:</strong> High-flow deluge & 36" mandatory clear zone.
            </div>
          </div>
        </div>

        <button class="drill-finish-btn" id="drill-finish-btn">
          Complete Safety Patrol ➔
        </button>
      </div>
    `;

    this._el.querySelector('#drill-finish-btn').addEventListener('click', () => {
      this._el.setAttribute('hidden', '');
      this._el.style.display = 'none';
      this._engine.chooseAction('continue_on');
    });
  }
}
