/**
 * PauseModal.js
 * 
 * In-game Pause Menu Modal for Two Pairs of Eyes:
 *  - Matches the exact design language, typography, and elegance of the Game Settings modal.
 *  - Triggered by HUD Pause button (vertical parallel bars ||), 'P' key, or ESC key.
 *  - Suspends gameplay, freezes timer, and halts avatar controls.
 *  - Provides 3 core navigation choices:
 *      1. Resume Patrol (continue exactly where paused)
 *      2. Game Settings (gear icon to open preferences modal)
 *      3. Return to Start Patrol (return directly to main start screen / briefing)
 */

import { playSfx } from '../utils/audio.js';
import { clearSessionCheckpoint } from '../utils/sessionStore.js';

const ZONE_NAMES = [
  'Zone 01 — Transit Line & Fluid Spill',
  'Zone 02 — Vehicle Transit & Blind Corner',
  'Zone 03 — High-Bay Storage & Damaged Racking',
  'Zone 04 — Charging Bay & Hazardous Storage',
  'Zone 05 — Dispatch Area & Emergency Hub',
];

export class PauseModal {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   * @param {object} engine
   * @param {object} [systemRefs] { cameraRig, characters, renderer, startScreen }
   */
  constructor(eventBus, engine, systemRefs = {}) {
    this._eventBus = eventBus;
    this._engine = engine;
    this._systemRefs = systemRefs;

    this._isOpen = false;
    this._currentStopIndex = 0;
    this._el = document.getElementById('pause-modal-overlay');

    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'pause-modal-overlay';
      this._el.className = 'pause-modal-overlay';
      this._el.setAttribute('role', 'dialog');
      this._el.setAttribute('aria-modal', 'true');
      this._el.setAttribute('aria-label', 'Simulation Paused');
      this._el.hidden = true;
      document.body.appendChild(this._el);
    }

    this._setupEventListeners();
  }

  _setupEventListeners() {
    // Track stop index for accurate telemetry
    this._eventBus.on('stop:entered', ({ stop }) => {
      const idx = parseInt(stop.id.split('_')[1], 10) - 1;
      this._currentStopIndex = idx >= 0 ? idx : 0;
    });

    // Listen for pause requests from HUD or other components
    this._eventBus.on('ui:pause-game', () => {
      this.open();
    });

    this._eventBus.on('ui:resume-game', () => {
      this.close();
    });

    this._eventBus.on('settings:closed', () => {
      if (this._isOpen) {
        const settingsBtn = this._el.querySelector('#pause-settings-btn');
        if (settingsBtn) settingsBtn.focus();
      }
    });

    // Keyboard shortcuts: 'P' or 'Escape'
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'p' || e.key === 'P') {
        const guideEl = document.querySelector('.user-guide-overlay') || document.querySelector('.guide-overlay');
        const guideOpen = guideEl && !guideEl.hasAttribute('hidden') && guideEl.style.display !== 'none';
        const settingsEl = document.getElementById('settings-modal-overlay');
        const settingsOpen = settingsEl && settingsEl.classList.contains('visible');
        if (guideOpen || settingsOpen) return;

        const startScreen = document.getElementById('start-screen');
        const isStartVisible = startScreen && !startScreen.hasAttribute('hidden') && startScreen.style.display !== 'none';
        const loginScreen = document.getElementById('login-screen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (isStartVisible || isLoginVisible) return;

        e.preventDefault();
        if (this._isOpen) {
          this.close();
        } else {
          this.open();
        }
      } else if (e.key === 'Escape' || e.code === 'Escape') {
        const guideEl = document.querySelector('.user-guide-overlay') || document.querySelector('.guide-overlay');
        const guideOpen = guideEl && !guideEl.hasAttribute('hidden') && guideEl.style.display !== 'none';
        if (guideOpen) return;

        const settingsEl = document.getElementById('settings-modal-overlay');
        const settingsOpen = settingsEl && settingsEl.classList.contains('visible');

        if (settingsOpen) return;

        const startScreen = document.getElementById('start-screen');
        const isStartVisible = startScreen && !startScreen.hasAttribute('hidden') && startScreen.style.display !== 'none';
        const loginScreen = document.getElementById('login-screen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (isStartVisible || isLoginVisible) return;

        if (this._isOpen) {
          e.preventDefault();
          this.close();
        } else {
          e.preventDefault();
          this.open();
        }
      }
    });
  }

  /**
   * Opens the Pause Menu modal card and freezes game activity.
   */
  open() {
    if (this._isOpen) return;
    this._isOpen = true;

    // Suspend player movement & camera dragging
    if (this._systemRefs.characters?.setControlsEnabled) {
      this._systemRefs.characters.setControlsEnabled(false);
    }
    if (this._systemRefs.cameraRig?.setControlsEnabled) {
      this._systemRefs.cameraRig.setControlsEnabled(false);
    }

    try {
      playSfx('ui-click');
    } catch (_) {}

    this._render();
    this._el.hidden = false;

    requestAnimationFrame(() => {
      this._el.classList.add('visible');
      const resumeBtn = this._el.querySelector('#pause-resume-btn');
      if (resumeBtn) resumeBtn.focus();
    });

    // Pause HUD timer and notify systems
    this._eventBus.emit('game:paused', { reason: 'pause-menu' });
  }

  /**
   * Closes the Pause Menu and resumes gameplay.
   */
  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    this._el.classList.remove('visible');
    setTimeout(() => {
      if (!this._isOpen) {
        this._el.hidden = true;
        this._el.innerHTML = '';
      }
    }, 220);

    // Restore player movement & camera dragging
    if (this._systemRefs.characters?.setControlsEnabled) {
      this._systemRefs.characters.setControlsEnabled(true);
    }
    if (this._systemRefs.cameraRig?.setControlsEnabled) {
      this._systemRefs.cameraRig.setControlsEnabled(true);
    }

    try {
      playSfx('ui-click');
    } catch (_) {}

    // Resume HUD timer and notify systems
    this._eventBus.emit('game:resumed', { reason: 'pause-menu' });
  }

  _render() {
    const zoneLabel = ZONE_NAMES[this._currentStopIndex] || `Zone 0${this._currentStopIndex + 1} — Warehouse Inspection`;

    this._el.innerHTML = `
      <div class="settings-modal-card pause-modal-card">
        <!-- Header: Styled strictly identically to the Settings Modal -->
        <div class="settings-modal-header pause-modal-header">
          <div class="settings-header-title">
            <svg class="settings-title-icon pause-title-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
              <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
            </svg>
            <h2>SIMULATION PAUSED</h2>
          </div>
          <button id="pause-close-btn" class="settings-close-btn" aria-label="Resume Simulation" title="Resume Simulation (ESC)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Telemetry bar: Clean, single-line industrial status -->
        <div class="pause-telemetry-strip">
          <span class="pause-live-dot" aria-hidden="true"></span>
          <span class="pause-telemetry-label">AUDIT CHECKPOINT:</span>
          <span class="pause-telemetry-val">${zoneLabel}</span>
        </div>

        <div class="pause-modal-body">
          <p class="pause-intro-note">
            The safety patrol is temporarily suspended. Your progress, compliance scores, and inspection decisions are preserved.
          </p>

          <div class="pause-actions-list">
            <!-- 1. Resume Patrol Button (Primary) -->
            <button id="pause-resume-btn" class="pause-option-row is-primary" type="button" aria-label="Resume Safety Patrol">
              <div class="pause-option-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4"></polygon>
                </svg>
              </div>
              <div class="pause-option-text">
                <span class="pause-option-title">Resume Safety Patrol</span>
                <span class="pause-option-desc">Continue the inspection exactly where you paused</span>
              </div>
              <div class="pause-shortcut-badge">
                <kbd>ESC</kbd> / <kbd>P</kbd>
              </div>
            </button>

            <!-- 2. Game Settings Button (Secondary) -->
            <button id="pause-settings-btn" class="pause-option-row" type="button" aria-label="Open Game Settings">
              <div class="pause-option-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <div class="pause-option-text">
                <span class="pause-option-title">Game Settings & Preferences</span>
                <span class="pause-option-desc">Audio volume, graphic quality, controls & accessibility</span>
              </div>
              <svg class="pause-option-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            <!-- 3. Return to Start Patrol Button (Tertiary) -->
            <button id="pause-start-screen-btn" class="pause-option-row is-return" type="button" aria-label="Return to Start Patrol Screen">
              <div class="pause-option-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div class="pause-option-text">
                <span class="pause-option-title">Return to Start Patrol</span>
                <span class="pause-option-desc">Exit to the main briefing & mission start screen</span>
              </div>
              <svg class="pause-option-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- Footer: Matches the Settings Modal footer bar -->
        <div class="settings-modal-footer pause-modal-footer">
          <div class="pause-footer-compliance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <span>Session Status: <strong>Preserved in Memory</strong></span>
          </div>
          <div class="pause-footer-hint">
            Press <kbd>ESC</kbd> or <kbd>P</kbd> to resume
          </div>
        </div>
      </div>
    `;

    // ─── Attach Listeners ──────────────────────────────────────────
    const closeBtn = this._el.querySelector('#pause-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    const resumeBtn = this._el.querySelector('#pause-resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    const settingsBtn = this._el.querySelector('#pause-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this._eventBus.emit('ui:open-settings');
      });
    }

    const startScreenBtn = this._el.querySelector('#pause-start-screen-btn');
    if (startScreenBtn) {
      startScreenBtn.addEventListener('click', () => {
        try {
          playSfx('ui-click');
          const currentTrainee = window.__app?.trainee;
          if (currentTrainee) {
            sessionStorage.setItem('technova_trainee_session', JSON.stringify(currentTrainee));
          }
          sessionStorage.setItem('technova_return_to_start', 'true');
        } catch (_) {}
        clearSessionCheckpoint();
        window.location.reload();
      });
    }
  }
}
