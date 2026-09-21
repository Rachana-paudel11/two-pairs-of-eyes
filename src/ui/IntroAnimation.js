/**
 * IntroAnimation.js
 *
 * Dedicated component for the "Two Pairs of Eyes" opening animation:
 *  1. Initial scanning reticle (~1s)
 *  2. Eye logo reveal & glow (~1.2s) - emerges from reticle center & remains visible
 *  3. Title reveal ("TWO PAIRS OF EYES") (~0.8s)
 *  4. Tagline reveal ("IDENTIFY • DECIDE • PROTECT") (~0.8s)
 *  5. Transition to Loading Screen card ("INITIALIZING SIMULATION...")
 *  6. Progress checklist linked with 3D asset preloading
 *  7. Smooth crossfade into Main Menu (StartScreen).
 */

export class IntroAnimation {
  constructor() {
    this._el = null;
    this._onCompleteCallback = null;
    this._isFinished = false;
    this._logoSrc = null;
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
        <!-- Shared Focal Stage (Reticle and Logo overlap in exact center) -->
        <div class="intro-focal-stage">
          <!-- Scanning Reticle -->
          <div class="scanning-reticle" id="scanning-reticle">
            <div class="reticle-circle ring-outer"></div>
            <div class="reticle-circle ring-inner"></div>
            <div class="reticle-crosshair ch-h"></div>
            <div class="reticle-crosshair ch-v"></div>
            <div class="reticle-pulse-dot"></div>
            <div class="reticle-sweep"></div>
          </div>

          <!-- Eye Logo Container (Image or SVG fallback) -->
          <div class="intro-eye-logo-wrap" id="intro-eye-logo">
            <div id="intro-logo-holder" class="logo-holder">
              <!-- SVG Eye Logo Fallback -->
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
                <ellipse cx="70" cy="40" rx="60" ry="32" fill="url(#eyeBgGlow)" />
                <path d="M10 40 Q70 2 130 40 Q70 78 10 40 Z" stroke="#839958" stroke-width="3" fill="rgba(10, 51, 35, 0.45)" class="eye-contour" />
                <path d="M22 40 Q70 12 118 40 Q70 68 22 40 Z" stroke="rgba(247, 244, 213, 0.2)" stroke-width="1.5" />
                <circle cx="70" cy="40" r="24" fill="#0A3323" stroke="#839958" stroke-width="2.5" />
                <circle cx="70" cy="40" r="16" fill="#105666" stroke="#839958" stroke-width="1" />
                <circle cx="70" cy="40" r="10" fill="#F7F4D5" />
                <circle cx="70" cy="40" r="5" fill="#0B0D12" />
                <path d="M70 16 A 24 24 0 0 1 94 40" stroke="url(#arcGrad)" stroke-width="5" stroke-linecap="round" class="eye-arc-accent" />
                <circle cx="65" cy="35" r="3" fill="#FFFFFF" opacity="0.95" />
                <circle cx="61" cy="38" r="1.5" fill="#FFFFFF" opacity="0.8" />
              </svg>
            </div>
            <div class="logo-floor-reflection" aria-hidden="true"></div>
          </div>
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
    this._checkExistingLogoAsset();
  }

  async _checkExistingLogoAsset() {
    const candidates = [
      '/assets/images/logo.png',
      '/assets/images/two_pairs_logo.png',
      '/assets/images/logo.svg',
      '/assets/images/eye_logo.png'
    ];

    for (const src of candidates) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 200);
        const res = await fetch(src, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && (contentType.includes('image') || contentType.includes('svg') || contentType.includes('png'))) {
          const holder = this._el.querySelector('#intro-logo-holder');
          if (holder) {
            holder.innerHTML = `<img src="${src}" alt="Two Pairs of Eyes Logo" class="intro-eye-img" />`;
            this._logoSrc = src;
          }
          break;
        }
      } catch (err) {
        // ignore fetch errors
      }
    }
  }

  /**
   * Run the intro sequence and return a Promise that resolves when loading finishes.
   * @param {Object|Function} preloadTasks Async 3D preloading tasks
   * @returns {Promise<void>}
   */
  async play(preloadTasks = null) {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion) {
      this._el.classList.add('reduced-motion');
      if (preloadTasks) await this._animateLoadingChecklist(preloadTasks);
      this._complete();
      return;
    }

    // Step 1: Initial scanning reticle (0s -> 0.8s)
    console.log('[INTRO] phase-start');
    await this._delay(100);
    this._el.classList.add('phase-scan');

    // Step 2: Logo reveal (0.8s)
    await this._delay(800);
    console.log('[INTRO] logo-visible');
    this._el.classList.add('phase-logo');

    // Step 3: Title reveal (1.6s)
    await this._delay(800);
    this._el.classList.add('phase-title');

    // Step 4: Tagline reveal (2.4s)
    await this._delay(700);
    this._el.classList.add('phase-tagline');

    // Step 5: Transition to Loading Screen (~0.7s)
    await this._delay(700);
    console.log('[INTRO] loading-start');
    this._el.classList.add('phase-loading');

    // Step 6: Step-by-step progress checklist sequence
    await this._animateLoadingChecklist(preloadTasks);

    // Step 7: Complete and crossfade to Main Menu
    console.log('[INTRO] transitioning-to-menu');
    await this._delay(300);
    this._complete();
  }

  async _animateLoadingChecklist(preloadTasks) {
    const progressBar = this._el.querySelector('#loader-progress-bar');
    const statusText = this._el.querySelector('#loader-status-text');

    let loadFn = null;
    if (preloadTasks && typeof preloadTasks === 'object') {
      loadFn = async () => {
        if (preloadTasks.loadWarehouse) await preloadTasks.loadWarehouse();
        if (preloadTasks.loadCharacters) await preloadTasks.loadCharacters();
      };
    } else if (typeof preloadTasks === 'function') {
      loadFn = preloadTasks;
    }

    const items = [
      { num: 1, start: 0, end: 25 },
      { num: 2, start: 25, end: 50 },
      { num: 3, start: 50, end: 75 },
      { num: 4, start: 75, end: 100 }
    ];

    // Start 3D loading task concurrently with a safety timeout
    const preloadPromise = loadFn
      ? this._executeWithTimeout(loadFn, 10000, '3D Scene Assets')
      : Promise.resolve(true);

    for (const item of items) {
      const el = this._el.querySelector(`#check-item-${item.num}`);
      if (!el) continue;

      this._updateItemState(item.num, 'active', item.start);

      const duration = 250;
      const startTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const currentPct = Math.floor(item.start + progress * (item.end - item.start));

          if (progressBar) progressBar.style.width = `${currentPct}%`;
          if (statusText) statusText.textContent = `${currentPct}% COMPLETE`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            this._updateItemState(item.num, 'completed', 100);
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });

      await this._delay(80);
    }

    // Ensure 3D asset preloading has settled
    await preloadPromise;

    if (progressBar) progressBar.style.width = '100%';
    if (statusText) statusText.textContent = 'SIMULATION READY';
    console.log('[INTRO] loading-complete');
    await this._delay(250);
  }

  async _executeWithTimeout(asyncFn, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[INTRO] ${label} loading timed out after ${timeoutMs}ms. Continuing fallback.`);
        resolve(false);
      }, timeoutMs);
    });

    try {
      const taskPromise = Promise.resolve().then(() => asyncFn()).then(() => true).catch((err) => {
        console.error(`[INTRO] ${label} loading failed with error:`, err);
        return false;
      });

      const result = await Promise.race([taskPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[INTRO] Error executing ${label} task:`, err);
      return false;
    }
  }

  _updateItemState(itemNum, state, percentVal = 100) {
    const el = this._el.querySelector(`#check-item-${itemNum}`);
    if (!el) return;

    el.classList.remove('pending', 'active', 'completed', 'failed');
    el.classList.add(state);

    const iconSpan = el.querySelector('.item-status-icon');
    const percentSpan = el.querySelector('.item-percent');

    if (percentSpan) {
      percentSpan.textContent = `${percentVal}%`;
    }

    if (iconSpan) {
      if (state === 'active') {
        iconSpan.className = 'item-status-icon active';
        iconSpan.innerHTML = `<span class="spinner-ring"></span>`;
      } else if (state === 'completed') {
        iconSpan.className = 'item-status-icon done';
        iconSpan.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#839958" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      } else if (state === 'failed') {
        iconSpan.className = 'item-status-icon failed';
        iconSpan.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d3968c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
      }
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _complete() {
    if (this._isFinished) return;
    this._isFinished = true;

    this._el.classList.add('intro-fade-out');

    // Trigger simulation render & StartScreen briefing immediately so they
    // crossfade underneath the fading intro overlay with zero blank screen gap
    if (this._onCompleteCallback) {
      this._onCompleteCallback();
    }

    setTimeout(() => {
      if (this._el && this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
      console.log('[INTRO] intro-complete');
    }, 600);
  }

  onComplete(fn) {
    this._onCompleteCallback = fn;
  }
}
