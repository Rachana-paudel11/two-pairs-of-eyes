/**
 * IntroAnimation.js
 *
 * Dedicated component/module for the "Two Pairs of Eyes" opening animation:
 *  1. Initial scanning reticle (~1s)
 *  2. Eye logo reveal & glow (~1.2s)
 *  3. Title reveal ("TWO PAIRS OF EYES" / "WORKPLACE SAFETY SIMULATION") (~0.8s)
 *  4. Tagline reveal ("IDENTIFY • DECIDE • PROTECT") (~0.8s)
 *  5. Transition to Loading Screen card ("INITIALIZING SIMULATION...")
 *  6. Progress states checklist:
 *     - Loading warehouse environment
 *     - Loading safety scenarios
 *     - Loading personnel
 *     - Calibrating simulation
 *  7. Smooth crossfade into the Main Menu (StartScreen).
 *
 * Keeps animation state separate from gameplay state.
 */

export class IntroAnimation {
  constructor() {
    this._el = null;
    this._onCompleteCallback = null;
    this._isFinished = false;
    this._initDOM();
  }

  _initDOM() {
    this._el = document.createElement('div');
    this._el.id = 'intro-overlay';
    this._el.className = 'intro-overlay';
    this._el.setAttribute('aria-live', 'polite');

    this._el.innerHTML = `
      <div class="intro-ambient-glow" aria-hidden="true"></div>

      <!-- BRAND PRESENTATION STAGE -->
      <div class="intro-brand-stage" id="intro-brand-stage">
        <!-- Scanning Reticle -->
        <div class="scanning-reticle" id="scanning-reticle">
          <div class="reticle-circle ring-outer"></div>
          <div class="reticle-circle ring-inner"></div>
          <div class="reticle-crosshair ch-h"></div>
          <div class="reticle-crosshair ch-v"></div>
          <div class="reticle-pulse-dot"></div>
          <div class="reticle-sweep"></div>
        </div>

        <!-- SVG Eye Logo -->
        <div class="intro-eye-logo-wrap" id="intro-eye-logo">
          <svg class="intro-eye-svg" viewBox="0 0 140 80" fill="none" aria-label="Two Pairs of Eyes Safety Logo">
            <defs>
              <radialGradient id="eyeBgGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#839958" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#0A3323" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#A4C26B"/>
                <stop offset="100%" stop-color="#839958"/>
              </linearGradient>
            </defs>
            <!-- Ambient Eye Glow -->
            <ellipse cx="70" cy="40" rx="60" ry="32" fill="url(#eyeBgGlow)" />
            <!-- Outer Eye Contour -->
            <path d="M10 40 Q70 2 130 40 Q70 78 10 40 Z" stroke="#839958" stroke-width="3" fill="rgba(10, 51, 35, 0.45)" class="eye-contour" />
            <!-- Inner Eye Contour Accent -->
            <path d="M22 40 Q70 12 118 40 Q70 68 22 40 Z" stroke="rgba(247, 244, 213, 0.2)" stroke-width="1.5" />
            <!-- Iris Outer Ring -->
            <circle cx="70" cy="40" r="24" fill="#0A3323" stroke="#839958" stroke-width="2.5" />
            <!-- Iris Inner Highlight Ring -->
            <circle cx="70" cy="40" r="16" fill="#105666" stroke="#839958" stroke-width="1" />
            <!-- Pupil -->
            <circle cx="70" cy="40" r="10" fill="#F7F4D5" />
            <circle cx="70" cy="40" r="5" fill="#0B0D12" />
            <!-- Top-Right Glowing Arc Accent (Matching reference image) -->
            <path d="M70 16 A 24 24 0 0 1 94 40" stroke="url(#arcGrad)" stroke-width="5" stroke-linecap="round" class="eye-arc-accent" />
            <!-- Catchlight Glint -->
            <circle cx="65" cy="35" r="3" fill="#FFFFFF" opacity="0.95" />
            <circle cx="61" cy="38" r="1.5" fill="#FFFFFF" opacity="0.8" />
          </svg>
          <div class="logo-floor-reflection" aria-hidden="true"></div>
        </div>

        <!-- Main Title -->
        <div class="intro-title-wrap" id="intro-title">
          <h1 class="intro-main-title">
            <span class="text-beige">TWO</span>
            <span class="text-moss">PAIRS</span>
            <span class="text-beige">OF EYES</span>
          </h1>
          <div class="intro-subtitle">WORKPLACE SAFETY SIMULATION</div>
        </div>

        <!-- Tagline -->
        <div class="intro-tagline-wrap" id="intro-tagline">
          <span class="tagline-line line-left" aria-hidden="true"></span>
          <span class="tagline-text">IDENTIFY &bull; DECIDE &bull; PROTECT</span>
          <span class="tagline-line line-right" aria-hidden="true"></span>
        </div>
      </div>

      <!-- LOADING SCREEN STAGE -->
      <div class="intro-loader-card" id="intro-loader-card">
        <div class="card-corner corner-tl"></div>
        <div class="card-corner corner-tr"></div>
        <div class="card-corner corner-bl"></div>
        <div class="card-corner corner-br"></div>

        <div class="loader-header">
          <span class="loader-pulsing-icon" aria-hidden="true">
            <span class="pulse-ring"></span>
          </span>
          <span class="loader-header-text">INITIALIZING SIMULATION...</span>
        </div>

        <ul class="loader-checklist">
          <li class="checklist-item" id="check-item-1">
            <span class="item-status-icon pending"><span class="spinner-ring"></span></span>
            <span class="item-label">Loading warehouse environment</span>
            <span class="item-percent">0%</span>
          </li>
          <li class="checklist-item" id="check-item-2">
            <span class="item-status-icon pending"><span class="spinner-ring"></span></span>
            <span class="item-label">Loading safety scenarios</span>
            <span class="item-percent">0%</span>
          </li>
          <li class="checklist-item" id="check-item-3">
            <span class="item-status-icon pending"><span class="spinner-ring"></span></span>
            <span class="item-label">Loading personnel</span>
            <span class="item-percent">0%</span>
          </li>
          <li class="checklist-item" id="check-item-4">
            <span class="item-status-icon pending"><span class="spinner-ring"></span></span>
            <span class="item-label">Calibrating simulation</span>
            <span class="item-percent">0%</span>
          </li>
        </ul>

        <div class="loader-progress-track">
          <div class="loader-progress-fill" id="loader-progress-bar" style="width: 0%"></div>
        </div>
        <div class="loader-footer-status" id="loader-status-text">INITIALIZING...</div>
      </div>
    `;

    document.body.appendChild(this._el);
  }

  /**
   * Run the intro sequence and return a Promise that resolves when loading finishes.
   * @param {() => Promise<void>} [onPreload3D] Optional async task (e.g. 3D assets loading)
   * @returns {Promise<void>}
   */
  async play(onPreload3D = null) {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion) {
      // Fast path for reduced motion
      this._el.classList.add('reduced-motion');
      if (onPreload3D) await onPreload3D();
      this._complete();
      return;
    }

    // Step 1: Initial scanning reticle (0s - 1.0s)
    await this._delay(100);
    this._el.classList.add('phase-scan');

    // Step 2: Logo reveal (1.0s)
    await this._delay(900);
    this._el.classList.add('phase-logo');

    // Step 3: Title reveal (2.0s)
    await this._delay(900);
    this._el.classList.add('phase-title');

    // Step 4: Tagline reveal (2.8s)
    await this._delay(800);
    this._el.classList.add('phase-tagline');

    // Step 5: Hold brand presentation briefly (~0.8s), then transition to Loading screen
    await this._delay(900);
    this._el.classList.add('phase-loading');

    // Start loading items animation & execute 3D preload task concurrently
    const preloadPromise = onPreload3D ? onPreload3D() : Promise.resolve();

    // Step 6: Step-by-step progress checklist sequence
    await this._animateLoadingChecklist(preloadPromise);

    // Step 7: Transition out overlay to Main Menu
    await this._delay(400);
    this._complete();
  }

  async _animateLoadingChecklist(preloadPromise) {
    const items = [
      { id: 'check-item-1', label: 'Warehouse environment', start: 0, end: 25 },
      { id: 'check-item-2', label: 'Safety scenarios', start: 25, end: 50 },
      { id: 'check-item-3', label: 'Personnel', start: 50, end: 75 },
      { id: 'check-item-4', label: 'Calibrating simulation', start: 75, end: 100 }
    ];

    const progressBar = this._el.querySelector('#loader-progress-bar');
    const statusText = this._el.querySelector('#loader-status-text');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const el = this._el.querySelector(`#${item.id}`);
      if (!el) continue;

      el.classList.add('active');

      // Animate percentage for this item over ~400ms
      const duration = 400;
      const startTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const currentPct = Math.floor(item.start + progress * (item.end - item.start));

          const percentSpan = el.querySelector('.item-percent');
          if (percentSpan) percentSpan.textContent = `${Math.floor(progress * 100)}%`;

          if (progressBar) progressBar.style.width = `${currentPct}%`;
          if (statusText) statusText.textContent = `${currentPct}% COMPLETE`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            // Mark item complete
            el.classList.remove('active');
            el.classList.add('completed');
            const iconSpan = el.querySelector('.item-status-icon');
            if (iconSpan) {
              iconSpan.className = 'item-status-icon done';
              iconSpan.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#839958" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              `;
            }
            const percentSpanDone = el.querySelector('.item-percent');
            if (percentSpanDone) percentSpanDone.textContent = '100%';
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });

      // Brief gap between checklist items
      await this._delay(150);
    }

    // Ensure 3D preloading has finished
    await preloadPromise;

    if (progressBar) progressBar.style.width = '100%';
    if (statusText) statusText.textContent = 'SIMULATION READY';
    await this._delay(350);
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _complete() {
    if (this._isFinished) return;
    this._isFinished = true;

    this._el.classList.add('intro-fade-out');

    setTimeout(() => {
      if (this._el && this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
      if (this._onCompleteCallback) {
        this._onCompleteCallback();
      }
    }, 600);
  }

  onComplete(fn) {
    this._onCompleteCallback = fn;
  }
}
