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

    this._render();
    this.show();
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
        <!-- Backdrop: darkened warehouse photo + diagonal accent wedge -->
        <div class="start-card-bg" aria-hidden="true"></div>
        <div class="start-card-wedge" aria-hidden="true"></div>

        <!-- Top Meta Header -->
        <div class="start-card-header">
          <div class="start-badge-pill">
            <svg class="badge-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <span>WORKPLACE SAFETY SIMULATION</span>
            <span class="badge-rule" aria-hidden="true"></span>
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
              <span class="title-line">TWO PAIRS</span>
              <span class="title-line title-accent">OF EYES</span>
            </h1>
            <h2 class="start-sub-title">3D WAREHOUSE SAFETY AUDIT</h2>

            <p class="start-desc">
              Join Supervisor Dave on morning patrol. Spot hidden warehouse hazards, make tough calls under pressure, and enforce health and safety standards to protect the team.
            </p>

            <div class="start-feature-chips">
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>5 Safety Zones</span>
              </div>
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Live Decisions</span>
              </div>
              <div class="feature-chip">
                <svg class="chip-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                  <line x1="12" y1="20" x2="12" y2="9"></line>
                  <line x1="18" y1="20" x2="18" y2="4"></line>
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
                <svg class="btn-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="13 6 19 12 13 18"></polyline>
                </svg>
              </button>

              <button id="start-guide-btn" class="start-guide-btn" aria-label="Open Interactive Guide">
                <svg class="btn-guide-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span>PATROL GUIDE</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Hero Cutout Stage -->
          <div class="start-right-col">
            <div class="hero-character-stage">
              <div class="stage-ambient-glow" aria-hidden="true"></div>
              <img src="/assets/images/dave_and_alex_cutout_hd.webp" width="1087" height="1150" decoding="async" alt="Alex and Dave" class="hero-character-img" />
            </div>
          </div>

          <!-- Side Rail: quick facts + motto -->
          <aside class="start-side-col">
            <ul class="start-stats" aria-label="Simulation facts">
              <li class="stat-item">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                <span class="stat-label">5 Zones</span>
              </li>
              <li class="stat-item">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span class="stat-label">Real Risks</span>
              </li>
              <li class="stat-item">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
                <span class="stat-label">Max Score</span>
                <strong class="stat-value">25</strong>
              </li>
            </ul>

            <p class="start-quote">
              &ldquo;Safety<br />is everyone&rsquo;s<br />job.&rdquo;
              <svg class="quote-swoosh" viewBox="0 0 100 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
                <path d="M2 11C30 5 62 3 98 2"></path>
              </svg>
            </p>
          </aside>
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
