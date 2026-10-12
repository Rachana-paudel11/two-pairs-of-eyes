/**
 * settings-manager.js
 * Centralized, lightweight Game Settings Manager for Two Pairs of Eyes.
 * 
 * Manages versioned configuration with validation, sanitization,
 * localStorage persistence, defaults restoration, and runtime application
 * to Audio, Graphics, Controls, and Accessibility subsystems.
 */

export const SETTINGS_STORAGE_KEY = 'technova_game_settings_v1';
export const SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_SCHEMA_VERSION,
  audio: {
    masterVolume: 85,     // 0 - 100 (%)
    sfxVolume: 80,        // 0 - 100 (%)
    dialogueVolume: 90,   // 0 - 100 (%)
    ambienceVolume: 50,   // 0 - 100 (%)
    muted: false
  },
  graphics: {
    quality: 'medium',    // 'low' | 'medium' | 'high'
    shadows: true,
    pixelRatioLimit: 1.0, // 0.75, 1.0, 1.5/2.0
    fullscreen: false
  },
  controls: {
    mouseSensitivity: 50, // 0 - 100 (maps to 0.0012 - 0.0064 rad/px)
    invertY: false
  },
  accessibility: {
    reducedMotion: false,
    fontSize: 'normal',   // 'normal' | 'large'
    subtitles: true,
    highContrast: false
  }
});

class SettingsManager {
  constructor() {
    this._settings = this._clone(DEFAULT_SETTINGS);
    this._listeners = new Set();
    this._eventBus = null;
    this._isInitialized = false;
  }

  /**
   * Attach simulation EventBus for reactive inter-system communication.
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   */
  attachEventBus(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Initializes settings: loads from localStorage, validates, and applies immediately.
   * Safe to call multiple times or without localStorage support.
   */
  init(eventBus = null) {
    if (eventBus) {
      this.attachEventBus(eventBus);
    }
    this.load();
    this.applyAll();
    this._isInitialized = true;
    return this._settings;
  }

  /**
   * Returns a deep copy of the current settings.
   */
  getSettings() {
    return this._clone(this._settings);
  }

  /**
   * Read a specific category or value.
   * @param {string} category 'audio' | 'graphics' | 'controls' | 'accessibility'
   */
  getCategory(category) {
    return this._clone(this._settings[category] || {});
  }

  /**
   * Updates partial settings, validates, persists to storage, and notifies listeners.
   * @param {object} partialUpdates
   */
  update(partialUpdates) {
    if (!partialUpdates || typeof partialUpdates !== 'object') return this.getSettings();

    const prevQuality = this._settings.graphics?.quality;
    const newQuality = partialUpdates.graphics?.quality;
    let shadowsUpdate = partialUpdates.graphics?.shadows;
    if (newQuality && newQuality !== prevQuality && shadowsUpdate === undefined) {
      shadowsUpdate = newQuality !== 'low';
    }

    const merged = {
      ...this._settings,
      audio: { ...this._settings.audio, ...(partialUpdates.audio || {}) },
      graphics: {
        ...this._settings.graphics,
        ...(partialUpdates.graphics || {}),
        ...(shadowsUpdate !== undefined ? { shadows: shadowsUpdate } : {})
      },
      controls: { ...this._settings.controls, ...(partialUpdates.controls || {}) },
      accessibility: { ...this._settings.accessibility, ...(partialUpdates.accessibility || {}) }
    };

    this._settings = this._sanitize(merged);
    this.save();
    this.applyAll();
    this._notify();

    return this.getSettings();
  }

  /**
   * Restores all settings to default factory values.
   */
  restoreDefaults() {
    this._settings = this._clone(DEFAULT_SETTINGS);
    this.save();
    this.applyAll();
    this._notify();
    return this.getSettings();
  }

  /**
   * Loads settings from localStorage with validation and corruption recovery.
   */
  load() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this._settings = this._clone(DEFAULT_SETTINGS);
        return;
      }

      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        this._settings = this._clone(DEFAULT_SETTINGS);
        return;
      }

      const parsed = JSON.parse(raw);
      this._settings = this._sanitize(parsed);
    } catch (err) {
      console.warn('[SettingsManager] Failed to load stored settings, resetting to defaults:', err.message);
      this._settings = this._clone(DEFAULT_SETTINGS);
    }
  }

  /**
   * Persists settings to localStorage safely.
   */
  save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this._settings));
      }
    } catch (err) {
      console.warn('[SettingsManager] Storage unavailable, settings preserved in memory:', err.message);
    }
  }

  /**
   * Dispatches changes to DOM, Audio engine, Renderer, and EventBus.
   */
  applyAll() {
    this.applyAudio();
    this.applyGraphics();
    this.applyControls();
    this.applyAccessibility();
  }

  applyAudio() {
    const { masterVolume, sfxVolume, dialogueVolume, ambienceVolume, muted } = this._settings.audio;

    if (this._eventBus) {
      this._eventBus.emit('settings:audio:applied', {
        masterVolume,
        sfxVolume,
        dialogueVolume,
        ambienceVolume,
        muted
      });
    }
  }

  applyGraphics() {
    const { quality, shadows, pixelRatioLimit, fullscreen } = this._settings.graphics;

    if (this._eventBus) {
      this._eventBus.emit('settings:graphics:applied', {
        quality,
        shadows,
        pixelRatioLimit,
        fullscreen
      });
    }
  }

  applyControls() {
    const { mouseSensitivity, invertY } = this._settings.controls;

    if (this._eventBus) {
      this._eventBus.emit('settings:controls:applied', {
        mouseSensitivity,
        invertY
      });
    }
  }

  applyAccessibility() {
    const { reducedMotion, fontSize, subtitles, highContrast } = this._settings.accessibility;

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.toggle('a11y-reduced-motion', Boolean(reducedMotion));
      root.classList.toggle('a11y-large-font', fontSize === 'large');
      root.classList.toggle('a11y-high-contrast', Boolean(highContrast));
    }

    if (this._eventBus) {
      this._eventBus.emit('settings:accessibility:applied', {
        reducedMotion,
        fontSize,
        subtitles,
        highContrast
      });
    }
  }

  /**
   * Register a callback to be notified when settings change.
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this._listeners.add(callback);
    }
    return () => {
      this._listeners.delete(callback);
    };
  }

  _notify() {
    const snapshot = this.getSettings();
    for (const listener of this._listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('[SettingsManager] Listener error:', e);
      }
    }
    if (this._eventBus) {
      this._eventBus.emit('settings:changed', snapshot);
    }
  }

  /**
   * Validates and sanitizes settings against the schema, applying fallbacks for invalid values.
   */
  _sanitize(input) {
    if (!input || typeof input !== 'object') {
      return this._clone(DEFAULT_SETTINGS);
    }

    const clamp = (val, min, max, fallback) => {
      const num = Number(val);
      if (isNaN(num)) return fallback;
      return Math.min(max, Math.max(min, Math.round(num)));
    };

    const audioIn = input.audio || {};
    const graphicsIn = input.graphics || {};
    const controlsIn = input.controls || {};
    const a11yIn = input.accessibility || {};

    const quality = ['low', 'medium', 'high'].includes(graphicsIn.quality)
      ? graphicsIn.quality
      : DEFAULT_SETTINGS.graphics.quality;

    let pixelRatioLimit = DEFAULT_SETTINGS.graphics.pixelRatioLimit;
    if (quality === 'low') pixelRatioLimit = 0.75;
    else if (quality === 'medium') pixelRatioLimit = 1.0;
    else if (quality === 'high') pixelRatioLimit = 1.5;

    return {
      version: SETTINGS_SCHEMA_VERSION,
      audio: {
        masterVolume: clamp(audioIn.masterVolume, 0, 100, DEFAULT_SETTINGS.audio.masterVolume),
        sfxVolume: clamp(audioIn.sfxVolume, 0, 100, DEFAULT_SETTINGS.audio.sfxVolume),
        dialogueVolume: clamp(audioIn.dialogueVolume, 0, 100, DEFAULT_SETTINGS.audio.dialogueVolume),
        ambienceVolume: clamp(audioIn.ambienceVolume, 0, 100, DEFAULT_SETTINGS.audio.ambienceVolume),
        muted: Boolean(audioIn.muted)
      },
      graphics: {
        quality,
        shadows: quality === 'low' ? false : (graphicsIn.shadows !== undefined ? Boolean(graphicsIn.shadows) : true),
        pixelRatioLimit,
        fullscreen: Boolean(graphicsIn.fullscreen)
      },
      controls: {
        mouseSensitivity: clamp(controlsIn.mouseSensitivity, 0, 100, DEFAULT_SETTINGS.controls.mouseSensitivity),
        invertY: Boolean(controlsIn.invertY)
      },
      accessibility: {
        reducedMotion: Boolean(a11yIn.reducedMotion),
        fontSize: ['normal', 'large'].includes(a11yIn.fontSize) ? a11yIn.fontSize : 'normal',
        subtitles: a11yIn.subtitles !== undefined ? Boolean(a11yIn.subtitles) : true,
        highContrast: Boolean(a11yIn.highContrast)
      }
    };
  }

  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

export const settingsManager = new SettingsManager();
export default settingsManager;
