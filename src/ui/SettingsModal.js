/**
 * SettingsModal.js
 * Production-ready Game Settings Modal for Two Pairs of Eyes.
 * 
 * Offers an accessible, industrial glass interface with 4 dedicated categories:
 *  1. Audio (Master, SFX, Dialogue, Ambience, Mute)
 *  2. Graphics (Quality presets Low/Medium/High, Shadows, Fullscreen)
 *  3. Controls (Mouse sensitivity, Invert Y, Comprehensive Controls Guide)
 *  4. Accessibility (Reduced Motion, High Contrast, Large Text, Subtitles)
 */

import { playSfx } from '../utils/audio.js';

export class SettingsModal {
  /**
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   * @param {import('../systems/settings-manager.js').SettingsManager} settingsManager
   * @param {object} [systemRefs] { cameraRig, characters, renderer }
   */
  constructor(eventBus, settingsManager, systemRefs = {}) {
    this._eventBus = eventBus;
    this._settingsManager = settingsManager;
    this._systemRefs = systemRefs;

    this._isOpen = false;
    this._activeTab = 'audio';
    this._el = document.getElementById('settings-modal-overlay');

    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'settings-modal-overlay';
      this._el.className = 'settings-modal-overlay';
      this._el.setAttribute('role', 'dialog');
      this._el.setAttribute('aria-modal', 'true');
      this._el.setAttribute('aria-label', 'Game Settings and Preferences');
      this._el.hidden = true;
      document.body.appendChild(this._el);
    }

    this._setupGlobalShortcuts();
    this._setupEventBus();
  }

  _setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Toggle settings on Escape key
      if (e.key === 'Escape' || e.code === 'Escape') {
        const guideEl = document.querySelector('.guide-overlay');
        const guideOpen = guideEl && !guideEl.hasAttribute('hidden') && guideEl.style.display !== 'none';
        
        // If guide is open, let guide close first
        if (guideOpen) return;

        // If settings is open, close it
        if (this._isOpen) {
          e.preventDefault();
          this.close();
        } else {
          // If in active gameplay (HUD visible, start screen hidden), open settings
          const startScreen = document.getElementById('start-screen');
          const isStartVisible = startScreen && !startScreen.hasAttribute('hidden') && startScreen.style.display !== 'none';
          const loginScreen = document.getElementById('login-screen');
          const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

          if (!isStartVisible && !isLoginVisible) {
            e.preventDefault();
            this.open();
          }
        }
      }
    });
  }

  _setupEventBus() {
    this._eventBus.on('ui:open-settings', () => {
      this.open();
    });

    this._eventBus.on('ui:close-settings', () => {
      this.close();
    });
  }

  /**
   * Opens the settings modal and suspends player inputs.
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
    this._el.classList.add('visible');

    // Emit event
    this._eventBus.emit('game:paused', { reason: 'settings' });
    this._eventBus.emit('settings:opened');

    // Focus first focusable element
    requestAnimationFrame(() => {
      const firstTab = this._el.querySelector('.settings-nav-tab.active') || this._el.querySelector('button');
      if (firstTab) firstTab.focus();
    });
  }

  /**
   * Closes the settings modal and restores player inputs.
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
    }, 200);

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

    // Emit event
    this._eventBus.emit('game:resumed', { reason: 'settings' });
    this._eventBus.emit('settings:closed');
  }

  _render() {
    const s = this._settingsManager.getSettings();

    this._el.innerHTML = `
      <div class="settings-modal-card">
        <div class="settings-modal-header">
          <div class="settings-header-title">
            <svg class="settings-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <h2>GAME SETTINGS</h2>
          </div>
          <button id="settings-close-btn" class="settings-close-btn" aria-label="Close Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav class="settings-nav-tabs" role="tablist">
          <button class="settings-nav-tab ${this._activeTab === 'audio' ? 'active' : ''}" data-tab="audio" role="tab" aria-selected="${this._activeTab === 'audio'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
            <span>Audio</span>
          </button>
          <button class="settings-nav-tab ${this._activeTab === 'graphics' ? 'active' : ''}" data-tab="graphics" role="tab" aria-selected="${this._activeTab === 'graphics'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span>Graphics</span>
          </button>
          <button class="settings-nav-tab ${this._activeTab === 'controls' ? 'active' : ''}" data-tab="controls" role="tab" aria-selected="${this._activeTab === 'controls'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <circle cx="8" cy="12" r="2"></circle>
              <path d="M15 9h2v6h-2z"></path>
            </svg>
            <span>Controls</span>
          </button>
          <button class="settings-nav-tab ${this._activeTab === 'accessibility' ? 'active' : ''}" data-tab="accessibility" role="tab" aria-selected="${this._activeTab === 'accessibility'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Accessibility</span>
          </button>
        </nav>

        <div class="settings-tab-content">
          ${this._renderTabContent(this._activeTab, s)}
        </div>

        <div class="settings-modal-footer">
          <button id="settings-restore-btn" class="settings-restore-btn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            <span>Restore Defaults</span>
          </button>

          <button id="settings-apply-close-btn" class="settings-save-btn" type="button">
            <span>Back to Simulation</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderTabContent(tab, s) {
    switch (tab) {
      case 'audio':
        return `
          <div class="settings-section">
            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Mute All Audio</span>
                <span class="row-desc">Immediately silences all sound effects, dialogue, and warehouse ambience.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-audio-mute" ${s.audio.muted ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-row slider-row">
              <div class="row-info">
                <span class="row-label">Master Volume</span>
                <span class="row-desc">Overall output level for the simulation.</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-audio-master" min="0" max="100" value="${s.audio.masterVolume}" class="range-slider">
                <span class="range-value" id="val-audio-master">${s.audio.masterVolume}%</span>
              </div>
            </div>

            <div class="settings-row slider-row">
              <div class="row-info">
                <span class="row-label">Sound Effects (SFX)</span>
                <span class="row-desc">Hazard warnings, decision feedback chimes, and UI interactions.</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-audio-sfx" min="0" max="100" value="${s.audio.sfxVolume}" class="range-slider">
                <span class="range-value" id="val-audio-sfx">${s.audio.sfxVolume}%</span>
              </div>
            </div>

            <div class="settings-row slider-row">
              <div class="row-info">
                <span class="row-label">Dialogue Speech</span>
                <span class="row-desc">Volume of Dave's safety observations and procedural voice lines.</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-audio-dialogue" min="0" max="100" value="${s.audio.dialogueVolume}" class="range-slider">
                <span class="range-value" id="val-audio-dialogue">${s.audio.dialogueVolume}%</span>
              </div>
            </div>

            <div class="settings-row slider-row">
              <div class="row-info">
                <span class="row-label">Warehouse Ambience</span>
                <span class="row-desc">Subtle industrial room hum and environmental atmospheric tone.</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-audio-ambience" min="0" max="100" value="${s.audio.ambienceVolume}" class="range-slider">
                <span class="range-value" id="val-audio-ambience">${s.audio.ambienceVolume}%</span>
              </div>
            </div>
          </div>
        `;

      case 'graphics':
        return `
          <div class="settings-section">
            <div class="settings-row">
              <div class="row-info">
                <span class="row-label">Visual Quality Preset</span>
                <span class="row-desc">Balances 3D rendering fidelity with frame rate performance.</span>
              </div>
              <div class="preset-pill-group">
                <button class="preset-pill ${s.graphics.quality === 'low' ? 'selected' : ''}" data-quality="low" type="button">Low</button>
                <button class="preset-pill ${s.graphics.quality === 'medium' ? 'selected' : ''}" data-quality="medium" type="button">Medium</button>
                <button class="preset-pill ${s.graphics.quality === 'high' ? 'selected' : ''}" data-quality="high" type="button">High</button>
              </div>
            </div>

            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Dynamic Shadows</span>
                <span class="row-desc">Real-time overhead directional shadow mapping for characters and warehouse racks.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-graphics-shadows" ${s.graphics.shadows ? 'checked' : ''} ${s.graphics.quality === 'low' ? 'disabled' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="row-info">
                <span class="row-label">Render Resolution Scaling</span>
                <span class="row-desc">Active device pixel ratio scaling factor.</span>
              </div>
              <div class="badge-display">
                <span class="tech-badge">${s.graphics.quality === 'low' ? '0.75x (Performance)' : (s.graphics.quality === 'high' ? '1.50x (Crisp Retina)' : '1.00x (Native)')}</span>
              </div>
            </div>

            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Fullscreen Mode</span>
                <span class="row-desc">Expand simulation canvas to fill the entire monitor.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-graphics-fullscreen" ${Boolean(document.fullscreenElement) ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        `;

      case 'controls':
        return `
          <div class="settings-section">
            <div class="settings-row slider-row">
              <div class="row-info">
                <span class="row-label">Mouse Look Sensitivity</span>
                <span class="row-desc">Adjust camera rotational speed when dragging the mouse.</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-controls-sens" min="0" max="100" value="${s.controls.mouseSensitivity}" class="range-slider">
                <span class="range-value" id="val-controls-sens">${s.controls.mouseSensitivity}%</span>
              </div>
            </div>

            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Invert Vertical Look (Y-Axis)</span>
                <span class="row-desc">Inverts vertical camera pitch movement.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-controls-inverty" ${s.controls.invertY ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="controls-guide-box">
              <h4 class="guide-box-title">SIMULATION CONTROLS SUMMARY</h4>
              <div class="key-guide-grid">
                <div class="key-guide-item">
                  <div class="key-badge-row">
                    <span class="key-cap">W</span><span class="key-cap">A</span><span class="key-cap">S</span><span class="key-cap">D</span>
                    <span class="key-or">/</span>
                    <span class="key-cap">↑</span><span class="key-cap">←</span><span class="key-cap">↓</span><span class="key-cap">→</span>
                  </div>
                  <span class="key-desc">Walk Alex through warehouse corridor</span>
                </div>
                <div class="key-guide-item">
                  <div class="key-badge-row">
                    <span class="key-cap">Left Drag</span>
                  </div>
                  <span class="key-desc">Rotate inspection camera (360° audit)</span>
                </div>
                <div class="key-guide-item">
                  <div class="key-badge-row">
                    <span class="key-cap">Mouse Click</span>
                  </div>
                  <span class="key-desc">Select hazard decisions & action buttons</span>
                </div>
                <div class="key-guide-item">
                  <div class="key-badge-row">
                    <span class="key-cap">ESC</span>
                  </div>
                  <span class="key-desc">Open / close Settings & pause simulation</span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'accessibility':
        return `
          <div class="settings-section">
            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Subtitles</span>
                <span class="row-desc">Show high-contrast speech text overlays for all of Dave's dialogue lines.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-a11y-subtitles" ${s.accessibility.subtitles ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">Reduced Motion</span>
                <span class="row-desc">Reduces UI slide animations and camera sway effects.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-a11y-motion" ${s.accessibility.reducedMotion ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="row-info">
                <span class="row-label">Text Sizing</span>
                <span class="row-desc">Increases font scale on inspection dialogue and UI labels.</span>
              </div>
              <div class="preset-pill-group">
                <button class="preset-pill ${s.accessibility.fontSize === 'normal' ? 'selected' : ''}" data-fontsize="normal" type="button">Default</button>
                <button class="preset-pill ${s.accessibility.fontSize === 'large' ? 'selected' : ''}" data-fontsize="large" type="button">Large</button>
              </div>
            </div>

            <div class="settings-row toggle-row">
              <div class="row-info">
                <span class="row-label">High Contrast Mode</span>
                <span class="row-desc">Heightens border contrast and panel text legibility across all views.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="setting-a11y-contrast" ${s.accessibility.highContrast ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        `;
    }
  }

  _bindEvents() {
    // Tab switching
    this._el.querySelectorAll('.settings-nav-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const targetTab = tabBtn.dataset.tab;
        if (targetTab && targetTab !== this._activeTab) {
          this._activeTab = targetTab;
          try {
            playSfx('ui-click');
          } catch (_) {}
          this._render();
        }
      });
    });

    // Close buttons
    const closeBtn = this._el.querySelector('#settings-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const saveCloseBtn = this._el.querySelector('#settings-apply-close-btn');
    if (saveCloseBtn) saveCloseBtn.addEventListener('click', () => this.close());

    // Restore defaults
    const restoreBtn = this._el.querySelector('#settings-restore-btn');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        this._settingsManager.restoreDefaults();
        try {
          playSfx('decision-safe');
        } catch (_) {}
        this._render();
      });
    }

    // Audio Bindings
    const muteToggle = this._el.querySelector('#setting-audio-mute');
    if (muteToggle) {
      muteToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ audio: { muted: e.target.checked } });
      });
    }

    this._bindSlider('setting-audio-master', 'val-audio-master', (val) => {
      this._settingsManager.update({ audio: { masterVolume: val } });
    });

    this._bindSlider('setting-audio-sfx', 'val-audio-sfx', (val) => {
      this._settingsManager.update({ audio: { sfxVolume: val } });
    });

    this._bindSlider('setting-audio-dialogue', 'val-audio-dialogue', (val) => {
      this._settingsManager.update({ audio: { dialogueVolume: val } });
    });

    this._bindSlider('setting-audio-ambience', 'val-audio-ambience', (val) => {
      this._settingsManager.update({ audio: { ambienceVolume: val } });
    });

    // Graphics Quality Preset Buttons
    this._el.querySelectorAll('.preset-pill[data-quality]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.quality;
        this._settingsManager.update({ graphics: { quality: q } });
        try {
          playSfx('ui-click');
        } catch (_) {}
        this._render();
      });
    });

    const shadowToggle = this._el.querySelector('#setting-graphics-shadows');
    if (shadowToggle) {
      shadowToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ graphics: { shadows: e.target.checked } });
      });
    }

    const fullscreenToggle = this._el.querySelector('#setting-graphics-fullscreen');
    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('change', async (e) => {
        try {
          if (e.target.checked) {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            }
          } else {
            if (document.fullscreenElement && document.exitFullscreen) {
              await document.exitFullscreen();
            }
          }
        } catch (err) {
          console.warn('[SettingsModal] Fullscreen request prevented:', err.message);
          e.target.checked = Boolean(document.fullscreenElement);
        }
      });
    }

    // Controls Bindings
    this._bindSlider('setting-controls-sens', 'val-controls-sens', (val) => {
      this._settingsManager.update({ controls: { mouseSensitivity: val } });
      if (this._systemRefs.cameraRig?.setSensitivity) {
        const s = this._settingsManager.getSettings();
        this._systemRefs.cameraRig.setSensitivity(val, s.controls.invertY);
      }
    });

    const invertYToggle = this._el.querySelector('#setting-controls-inverty');
    if (invertYToggle) {
      invertYToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ controls: { invertY: e.target.checked } });
        if (this._systemRefs.cameraRig?.setSensitivity) {
          const s = this._settingsManager.getSettings();
          this._systemRefs.cameraRig.setSensitivity(s.controls.mouseSensitivity, e.target.checked);
        }
      });
    }

    // Accessibility Bindings
    const subtitlesToggle = this._el.querySelector('#setting-a11y-subtitles');
    if (subtitlesToggle) {
      subtitlesToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ accessibility: { subtitles: e.target.checked } });
      });
    }

    const motionToggle = this._el.querySelector('#setting-a11y-motion');
    if (motionToggle) {
      motionToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ accessibility: { reducedMotion: e.target.checked } });
      });
    }

    const contrastToggle = this._el.querySelector('#setting-a11y-contrast');
    if (contrastToggle) {
      contrastToggle.addEventListener('change', (e) => {
        this._settingsManager.update({ accessibility: { highContrast: e.target.checked } });
      });
    }

    this._el.querySelectorAll('.preset-pill[data-fontsize]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.fontsize;
        this._settingsManager.update({ accessibility: { fontSize: size } });
        try {
          playSfx('ui-click');
        } catch (_) {}
        this._render();
      });
    });

    // Backdrop click to close
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) {
        this.close();
      }
    });
  }

  _bindSlider(sliderId, valueSpanId, onInput) {
    const slider = this._el.querySelector(`#${sliderId}`);
    const span = this._el.querySelector(`#${valueSpanId}`);
    if (slider && span) {
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        span.textContent = `${val}%`;
        onInput(val);
      });
    }
  }
}

export default SettingsModal;
