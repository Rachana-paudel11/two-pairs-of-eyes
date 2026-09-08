/**
 * StartScreen.js
 * 
 * Pre-simulation Welcome & Briefing Modal:
 *  - Displays title, description, character preview, and controls guide.
 *  - Calls engine.start() when player clicks "START PATROL".
 */

export class StartScreen {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   * @param {import('../engine/ScenarioEngine.js').ScenarioEngine} engine
   */
  constructor(eventBus, engine) {
    this._eventBus = eventBus;
    this._engine = engine;
    this._el = document.getElementById('start-screen');

    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'start-screen';
      this._el.className = 'start-screen-overlay';
      document.body.appendChild(this._el);
    }

    // Start hidden until intro animation completes
    this.hideImmediately();
    this._render();
  }

  show() {
    this._el.removeAttribute('hidden');
    this._el.style.display = 'flex';
    this._el.classList.remove('start-screen-fade-out');
    this._el.style.opacity = '1';
  }

  hideImmediately() {
    this._el.setAttribute('hidden', '');
    this._el.style.display = 'none';
    this._el.style.opacity = '0';
  }

  _render() {
    this._el.innerHTML = `
      <div class="start-modal-card">
        <!-- Top Meta Header -->
        <div class="start-card-header">
          <div class="start-badge-pill">
            <span class="badge-dot">●</span>
            <span>WORKPLACE SAFETY SIMULATION</span>
          </div>
          <div class="sim-ready-indicator">
            <span class="ready-live-bars" aria-hidden="true">
              <span class="live-bar bar-1"></span>
              <span class="live-bar bar-2"></span>
              <span class="live-bar bar-3"></span>
            </span>
            <span class="ready-live-text">SIMULATION READY</span>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="start-modal-content">
          <!-- Left Column -->
          <div class="start-left-col">
            <h1 class="start-main-title">
              TWO <span class="highlight-pairs">PAIRS</span> OF EYES
            </h1>
            <h2 class="start-sub-title">3D WAREHOUSE SAFETY AUDIT</h2>

            <p class="start-desc">
              Join Supervisor Dave on morning patrol. Spot hidden warehouse hazards, make tough calls under pressure, and enforce health and safety standards to protect the team.
            </p>

            <div class="start-feature-chips">
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>5 Safety Zones</span>
              </div>
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Live Decisions</span>
              </div>
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Zero-Harm Goal</span>
              </div>
            </div>

            <div class="start-action-row">
              <button id="start-patrol-btn" class="start-patrol-btn" aria-label="Start Safety Patrol">
                <svg class="btn-play-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4"></polygon>
                </svg>
                <span>START PATROL</span>
              </button>

              <button id="start-guide-btn" class="start-guide-btn" aria-label="Open Interactive Guide">
                <svg class="btn-guide-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>PATROL GUIDE</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Unboxed Hero Cutout Stage -->
          <div class="start-right-col">
            <div class="hero-character-stage">
              <div class="stage-ambient-glow" aria-hidden="true"></div>
              <img src="/assets/images/dave_and_alex_cutout-removebg-preview.png" alt="Alex and Dave" class="hero-character-img" />
              <div class="hero-roster-tag">
                <span class="roster-role">ALEX AND DAVE</span>
                <span class="roster-desc">Safety Officer and Shift Supervisor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const startBtn = this._el.querySelector('#start-patrol-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.hide();
        this._engine.start();
      });
    }

    const guideBtn = this._el.querySelector('#start-guide-btn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        this._eventBus.emit('ui:open-guide');
      });
    }
  }

  hide() {
    this._el.classList.add('start-screen-fade-out');
    setTimeout(() => {
      this._el.setAttribute('hidden', '');
      this._el.style.display = 'none';
    }, 350);
  }
}
