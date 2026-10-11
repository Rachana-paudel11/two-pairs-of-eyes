/**
 * Subtitles.js
 * High-contrast, accessible dialogue subtitles for Two Pairs of Eyes.
 * 
 * Synchronizes with simulation dialogue events (`dialogue:line`)
 * and respects user accessibility preferences (`subtitles: true/false`).
 */

export class Subtitles {
  /**
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   * @param {import('../systems/settings-manager.js').SettingsManager} settingsManager
   */
  constructor(eventBus, settingsManager) {
    this._eventBus = eventBus;
    this._settingsManager = settingsManager;
    this._el = document.getElementById('subtitles-overlay');
    this._enabled = true;
    this._activeTimeout = null;

    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'subtitles-overlay';
      this._el.className = 'subtitles-overlay';
      this._el.setAttribute('aria-live', 'polite');
      this._el.hidden = true;
      document.body.appendChild(this._el);
    }

    if (this._settingsManager) {
      const current = this._settingsManager.getCategory('accessibility');
      this._enabled = current.subtitles !== false;

      this._eventBus.on('settings:accessibility:applied', ({ subtitles }) => {
        this._enabled = subtitles !== false;
        if (!this._enabled) {
          this.hide();
        }
      });
    }

    this._setupListeners();
  }

  _setupListeners() {
    this._eventBus.on('dialogue:line', ({ name, line }) => {
      if (!this._enabled) return;
      this.show(name, line);
    });

    this._eventBus.on('action:resolved', () => {
      this.hide();
    });

    this._eventBus.on('stop:entered', () => {
      this.hide();
    });

    this._eventBus.on('session:complete', () => {
      this.hide();
    });
  }

  /**
   * Display subtitle line.
   * @param {string} speaker
   * @param {string} text
   */
  show(speaker, text) {
    if (!this._enabled || !text) return;

    if (this._activeTimeout) {
      clearTimeout(this._activeTimeout);
      this._activeTimeout = null;
    }

    this._el.innerHTML = `
      <div class="subtitle-card">
        <span class="subtitle-speaker">${speaker}:</span>
        <span class="subtitle-text">"${text}"</span>
      </div>
    `;

    this._el.hidden = false;
    this._el.classList.add('visible');

    // Auto-dismiss after reading duration (estimated based on word count, min 5s)
    const wordCount = text.split(/\s+/).length;
    const duration = Math.max(5500, wordCount * 350);

    this._activeTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    if (this._activeTimeout) {
      clearTimeout(this._activeTimeout);
      this._activeTimeout = null;
    }
    if (this._el) {
      this._el.classList.remove('visible');
      this._el.hidden = true;
      this._el.innerHTML = '';
    }
  }
}

export default Subtitles;
